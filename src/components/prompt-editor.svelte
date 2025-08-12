<script lang="ts">
  import type { AppData, Prompt, MessageType } from '../types';
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { PromptViewModel, createPromptViewModel, toPromptDsl } from '../promptops/dsl/prompt/renderer';
  import { storageService } from '../services/storage';

  // Props
  export let promptId: string | null = null; // nullなら新規

  // Local state
  const promptViewModel = writable<PromptViewModel>({
    id: '',
    name: '',
    template: '',
    fields: [],
    frameworkRef: '',
    metadata: {},
  });
  let isSaving = false;

  // Constants
  const MAX_PROMPT_CONTETNT_LENGTH = 10000;
  const MAX_PROMPT_NAME_LENGTH = 200;

  const dispatch = createEventDispatcher<{
    message: { text: string; type: MessageType };
    dataUpdated: { data: AppData };
    promptSelectionReset: void;
    back: void;
  }>();

  onMount(async () => {
    // 最新の保存データから読み直す（親との初期化競合を避ける）
    const latest = await storageService.getAppData();
    if (promptId) {
      const p = latest.prompts.find((pp) => pp.id === promptId);
      if (p) {
        promptViewModel.set(createPromptViewModel(p.content));
      }
    } else {
      promptViewModel.set({
        id: '',
        name: '',
        template: '',
        fields: [],
        frameworkRef: '',
        metadata: {},
      });
    }
  });

  async function save(): Promise<void> {
    if (!$promptViewModel.template.trim()) {
      dispatch('message', { text: 'プロンプト内容を入力してください', type: 'error' });
      return;
    }
    if ($promptViewModel.template.length > MAX_PROMPT_CONTETNT_LENGTH) {
      dispatch('message', { text: `プロンプト内容は${MAX_PROMPT_CONTETNT_LENGTH.toLocaleString()}文字以内で入力してください`, type: 'error' });
      return;
    }
    if ($promptViewModel.name && $promptViewModel.name.length > MAX_PROMPT_NAME_LENGTH) {
      dispatch('message', { text: `プロンプト名は${MAX_PROMPT_NAME_LENGTH}文字以内で入力してください`, type: 'error' });
      return;
    }

    try {
      isSaving = true;
      // 常に最新の保存済みデータを基に編集を反映（初期描画タイミング差異の影響を回避）
      const newData = await storageService.getAppData();

      $promptViewModel.name = $promptViewModel.name.trim() || 'プロンプト';
      if (promptId) {
        const target = newData.prompts.find((pp) => pp.id === promptId);
        if (target) {
          target.content = toPromptDsl($promptViewModel);
          target.updatedAt = new Date().toISOString();
        }
      } else {
        const id = crypto.randomUUID();
        $promptViewModel.id = id;
        const newPrompt: Prompt = {
          id,
          content: toPromptDsl($promptViewModel),
          order: newData.prompts.length + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newData.prompts.push(newPrompt);
      }

      await storageService.saveAppData(newData);
      dispatch('promptSelectionReset');
      dispatch('message', { text: 'プロンプトを保存しました', type: 'success' });
      dispatch('back');
    } catch (e) {
      console.error('プロンプト保存エラー:', e);
      dispatch('message', { text: 'プロンプトの保存に失敗しました', type: 'error' });
    } finally {
      isSaving = false;
    }
  }

  function backToList(): void {
    dispatch('back');
  }
</script>

<div class="prompt-editor">
  <button type="button" class="link-back" data-testid="back-to-list-button" on:click={backToList}>← LLMプロンプト一覧へ戻る</button>

  <div class="form-group">
    <label for="promptName">プロンプト名</label>
    <input
      type="text"
      id="promptName"
      data-testid="prompt-name-input"
      bind:value={$promptViewModel.name}
      placeholder="プロンプトの名前を入力"
    />
  </div>

  <div class="form-group">
    <label for="promptContent">プロンプト内容</label>
    <textarea
      id="promptContent"
      data-testid="prompt-content-input"
      bind:value={$promptViewModel.template}
      rows="10"
      placeholder="LLMプロンプトを入力">
    </textarea>
  </div>

  <div class="actions">
    <button id="savePrompt" class="primary-button" data-testid="save-prompt-button" on:click={save} disabled={isSaving}>
      {isSaving ? '保存中...' : '保存'}
    </button>
    <button id="cancelPrompt" class="secondary-button" data-testid="cancel-prompt-button" on:click={backToList} disabled={isSaving}>
      キャンセル
    </button>
  </div>
</div>

<style>
  .prompt-editor {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .link-back {
    align-self: flex-start;
    display: inline-flex;
    background: none;
    border: none;
    padding: 0;
    color: #0d6efd;
    cursor: pointer;
    text-decoration: underline;
    font-size: 13px;
    line-height: 1.6;
  }
  .link-back:hover { opacity: 0.85; }
  .form-group { display: flex; flex-direction: column; gap: 8px; }
  .actions { display: flex; gap: 10px; }
</style>


