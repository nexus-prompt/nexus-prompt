<script lang="ts">
  import type { Prompt } from '../types';
  import { autosize } from '../actions/autosize';
  
  import { type PromptViewModel, createPromptViewModel, toPromptDsl } from '../promptops/dsl/prompt/renderer';
  import { storageService } from '../services/storage';
  import { showToast, entitlements } from '../stores';

  // Local state
  let promptViewModel = $state<PromptViewModel>({
    id: '',
    name: '',
    template: '',
    fields: [],
    frameworkRef: '',
    metadata: {},
  });
  let isSaving = $state(false);

  // Constants
  const MAX_PROMPT_CONTETNT_LENGTH = 10000;
  const MAX_PROMPT_NAME_LENGTH = 200;
  const MAX_PROMPT_COUNT = 20;

  // Validation: プロンプトVMの検証ロジックを関数に分離
  function validatePromptViewModel(vm: PromptViewModel, maxNameLen: number, maxContentLen: number): string | null {
    if (!vm.template.trim()) {
      return 'プロンプト内容を入力してください';
    }
    if (vm.template.length > maxContentLen) {
      return `プロンプト内容は${maxContentLen.toLocaleString()}文字以内で入力してください`;
    }
    if (vm.name && vm.name.length > maxNameLen) {
      return `プロンプト名は${maxNameLen}文字以内で入力してください`;
    }
    return null;
  }

  // Event handler, Props
  let { promptSelectionReset, backToList, promptId } = $props();

  // 最新の保存データから読み直す（親との初期化競合を避ける）
  $effect(() => {
    (async () => {
      const latest = await storageService.getAppData();
      if (promptId) {
        const p = latest.prompts.find((pp) => pp.id === promptId);
        if (p) {
          promptViewModel = createPromptViewModel(p.content);
        } else {
          console.warn(`Prompt with id "${promptId}" not found. Navigating back to the list.`);
          showToast('指定されたプロンプトが見つかりませんでした。', 'error');
          backToList();
        }
      } else {
        promptViewModel = {
          id: '',
          name: '',
          template: '',
          fields: [],
          frameworkRef: '',
          metadata: {},
        };
      }
    })();
  });

  async function save(): Promise<void> {
    const validationError = validatePromptViewModel(
      promptViewModel,
      MAX_PROMPT_NAME_LENGTH,
      MAX_PROMPT_CONTETNT_LENGTH
    );
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    try {
      isSaving = true;
      // 常に最新の保存済みデータを基に編集を反映（初期描画タイミング差異の影響を回避）
      const newData = await storageService.getAppData();

      promptViewModel.name = promptViewModel.name.trim() || 'プロンプト';
      if (promptId) {
        const target = newData.prompts.find((pp) => pp.id === promptId);
        if (target) {
          target.content = toPromptDsl(promptViewModel);
          target.updatedAt = new Date().toISOString();
        }
      } else {
        if ($entitlements.isFree && newData.prompts.length >= MAX_PROMPT_COUNT) {
          showToast(`フリープランではプロンプトは${MAX_PROMPT_COUNT}個までしか作成できません。プランをアップグレードしてください。`, 'error');
          return;
        }
        const id = crypto.randomUUID();
        promptViewModel.id = id;
        const newPrompt: Prompt = {
          id,
          content: toPromptDsl(promptViewModel),
          order: newData.prompts.length + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        newData.prompts.push(newPrompt);
      }

      await storageService.saveAppData(newData);
      promptSelectionReset();
      showToast('プロンプトを保存しました', 'success');
      backToList();
    } catch (e) {
      console.error('プロンプト保存エラー:', e);
      showToast('プロンプトの保存に失敗しました', 'error');
    } finally {
      isSaving = false;
    }
  }

  function backToListHandler(): void {
    backToList();
  }
</script>

<div class="prompt-editor">
  <button type="button" class="link-back" data-testid="back-to-list-button" onclick={backToListHandler}>← LLMプロンプト一覧へ戻る</button>

  <div class="form-group">
    <label for="promptName">プロンプト名</label>
    <input
      type="text"
      id="promptName"
      data-testid="prompt-name-input"
      bind:value={promptViewModel.name}
      placeholder="プロンプトの名前を入力"
    />
  </div>

  <div class="form-group">
    <label for="promptContent">プロンプト内容</label>
    <textarea
      id="promptContent"
      data-testid="prompt-content-input"
      use:autosize={{ maxRows: 15, minRows: 10 }}
      bind:value={promptViewModel.template}
      placeholder="LLMプロンプトを入力">
    </textarea>
  </div>

  <div class="input-button-group">
    <button id="savePrompt" class="primary-button" data-testid="save-prompt-button" onclick={save} disabled={isSaving}>
      {isSaving ? '保存中...' : '保存'}
    </button>
    <button id="cancelPrompt" class="secondary-button" data-testid="cancel-prompt-button" onclick={backToListHandler} disabled={isSaving}>
      キャンセル
    </button>
  </div>
</div>

<style>
  @reference "tailwindcss";
  .prompt-editor {
    @apply flex flex-col p-0 h-full gap-4;
  }
  .link-back {
    @apply self-start inline-flex bg-none border-none p-0 text-[#0d6efd] cursor-pointer underline text-[13px] leading-6;
  }
  .link-back:hover { 
    @apply opacity-85;
  }
</style>
