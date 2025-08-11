<script lang="ts">
  import type { AppData, Prompt, MessageType, SnapshotData } from '../types';
  import { storageService } from '../services/storage';
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { PromptViewModel, toPromptDsl } from '../promptops/dsl/prompt/renderer';
  import PromptEditor from './prompt-editor.svelte';
  
  // Props
  export let currentData: AppData;
  export let currentSnapshot: SnapshotData;
  export let viewContext: 'popup' | 'sidepanel' | 'unknown';

  // Local state
  const promptViewModel = writable<PromptViewModel>({
    id: '',
    name: '',
    template: '',
    fields: [],
    frameworkRef: '',
    metadata: {},
  });
  // 画面状態と編集中ID
  let view: 'list' | 'edit' = 'list';
  let editingPromptId: string | null = null;
  let deletingIds: Set<string> = new Set();
  
  // Constants
  const MAX_PROMPT_CONTETNT_LENGTH = 10000;
  const MAX_PROMPT_NAME_LENGTH = 200;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    message: { text: string; type: MessageType };
    dataUpdated: { data: AppData };
    snapshotUpdated: { snapshot: SnapshotData };
    promptSelectionReset: void;
  }>();

  // Reactive: プロンプトリスト
  $: promptList = currentData.prompts || [];

  onMount(async () => {
    // サイドパネルとして開かれ、編集対象が指定されているかチェック
    if (viewContext === 'sidepanel' && currentSnapshot.editingTarget.type === 'prompt') {
      // ID が無くても新規作成の編集ビューを開く
      editingPromptId = currentSnapshot.editingTarget.id || null;
      view = 'edit';
      await storageService.clearEditingTarget();
      dispatch('snapshotUpdated', { snapshot: currentSnapshot });
    }
  });

  // 親の onMount 完了後に子の初期化を強制したいケースへの対策：
  // 親から渡される currentData/currentSnapshot は初期化後に変わる可能性があるため、
  // 初回 tick 後に実行することで、親の初期化完了を待つ。
  import { tick } from 'svelte';
  onMount(async () => {
    await tick();
  });

  function openEditor(promptId: string | null = null): void {
    editingPromptId = promptId;
    view = 'edit';
  }

  async function openEditorInSidePanel(promptId: string): Promise<void> {
    // サイドパネル環境なら単純にエディタを開く
    if (viewContext === 'sidepanel') {
      openEditor(promptId);
      return;
    }

    // サイドパネル API が利用できない（またはテスト環境）場合はフォールバック
    const isHeadless = typeof navigator !== 'undefined' && /Headless/i.test(navigator.userAgent || '');
    const canUseSidePanel = Boolean((chrome as any)?.sidePanel?.open) && Boolean((chrome as any)?.windows?.getCurrent) && !isHeadless;
    if (!canUseSidePanel) {
      openEditor(promptId);
      return;
    }

    try {
      const newSnapshot = structuredClone(currentSnapshot);
      newSnapshot.editingTarget = { type: 'prompt', id: promptId };
      newSnapshot.activeTab = 'prompts';
      await storageService.saveSnapshot(newSnapshot);
      dispatch('snapshotUpdated', { snapshot: newSnapshot });

      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id! });
      // ポップアップとして開かれている場合はクローズ
      try {
        const isPopup = Boolean((chrome as any)?.extension?.getViews?.({ type: 'popup' })?.includes(window as any));
        if (isPopup) {
          window.close();
        }
      } catch {
        // no-op
      }
    } catch {
      // 何らかの理由でサイドパネルが開けない場合はフォールバック
      openEditor(promptId);
    }
  }

  // 新規作成時にサイドパネルでエディタを開く
  async function openNewEditorInSidePanel(): Promise<void> {
    if (viewContext === 'sidepanel') {
      openEditor(null);
      return;
    }

    const isHeadless = typeof navigator !== 'undefined' && /Headless/i.test(navigator.userAgent || '');
    const canUseSidePanel = Boolean((chrome as any)?.sidePanel?.open) && Boolean((chrome as any)?.windows?.getCurrent) && !isHeadless;
    if (!canUseSidePanel) {
      openEditor(null);
      return;
    }

    try {
      const newSnapshot = structuredClone(currentSnapshot);
      // id 空を新規作成のシグナルとして扱う
      newSnapshot.editingTarget = { type: 'prompt', id: '' };
      newSnapshot.activeTab = 'prompts';
      await storageService.saveSnapshot(newSnapshot);
      dispatch('snapshotUpdated', { snapshot: newSnapshot });

      const currentWindow = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: currentWindow.id! });
      // ポップアップとして開かれている場合はクローズ
      try {
        const isPopup = Boolean((chrome as any)?.extension?.getViews?.({ type: 'popup' })?.includes(window as any));
        if (isPopup) {
          window.close();
        }
      } catch {
        // no-op
      }
    } catch {
      openEditor(null);
    }
  }

  async function deletePrompt(promptId: string): Promise<void> {
    if (confirm('このプロンプトを削除してもよろしいですか？')) {
      try {
        deletingIds = new Set([...deletingIds, promptId]);
        // イミュータブルな更新
        const newData = structuredClone(currentData);
        
        // 削除対象のプロンプトのorderを取得
        const deletedPrompt = newData.prompts.find(p => p.id === promptId);
        const deletedOrder = deletedPrompt?.order || 0;
        
        // プロンプトを削除
        newData.prompts = newData.prompts.filter(p => p.id !== promptId);
        
        // 削除されたorder以降のプロンプトのorderを-1する
        newData.prompts.forEach(prompt => {
          if (prompt.order > deletedOrder && prompt.order > 1) {
            prompt.order -= 1;
          }
        });
        
        await storageService.saveAppData(newData);
        
        dispatch('message', { text: 'プロンプトを削除しました', type: 'success' });
        dispatch('dataUpdated', { data: newData });
        dispatch('promptSelectionReset');
      } catch (error) {
        console.error('プロンプト削除エラー:', error);
        dispatch('message', { text: 'プロンプトの削除に失敗しました', type: 'error' });
      } finally {
        deletingIds = new Set([...deletingIds].filter(id => id !== promptId));
      }
    }
  }

  async function savePromptModal(): Promise<void> {
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
      // イミュータブルな更新
      const newData = structuredClone(currentData);
      
      $promptViewModel.name = $promptViewModel.name.trim() || 'プロンプト';
      if (editingPromptId) {
        const prompt = newData.prompts.find(p => p.id === editingPromptId);
        if (prompt) {
          prompt.content = toPromptDsl($promptViewModel);
          prompt.updatedAt = new Date().toISOString();
        }
      } else {
        const id = crypto.randomUUID();
        $promptViewModel.id = id;
        const newPrompt: Prompt = {
          id: id,
          content: toPromptDsl($promptViewModel),
          order: newData.prompts.length + 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        newData.prompts.push(newPrompt);
      }

      await storageService.saveAppData(newData);
      
      dispatch('promptSelectionReset');
      dispatch('message', { text: 'プロンプトを保存しました', type: 'success' });
      dispatch('dataUpdated', { data: newData });
      
      // 保存後は一覧へ戻る
      view = 'list';
    } catch (error) {
      console.error('プロンプト保存エラー:', error);
      dispatch('message', { text: 'プロンプトの保存に失敗しました', type: 'error' });
    }
  }

  function backToList(): void {
    view = 'list';
    editingPromptId = null;
  }

  // 型だけ残っている旧APIを参照している箇所を整理（ビュー遷移で保存はエディタ内で完結）
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  void savePromptModal; // keep reference to satisfy linter for transitional API
</script>

<div class="prompts-container">
  {#if view === 'list'}
    <div class="prompt-header">
      <button id="newPromptButton" class="primary-button" data-testid="new-prompt-button" on:click={openNewEditorInSidePanel}>新規作成</button>
    </div>
    <div id="promptList" data-testid="prompt-list" class="prompt-list">
      {#each promptList as prompt}
      <div class="prompt-item" data-testid="prompt-item">
        <div class="prompt-info">
          <h4>{prompt.content.name}</h4>
          <p>{prompt.content.template.substring(0, 50)}...</p>
        </div>
        <div class="prompt-actions">
          <button class="edit-button" on:click={() => openEditorInSidePanel(prompt.id)} disabled={deletingIds.has(prompt.id)}>編集</button>
          <button class="delete-button" on:click={() => deletePrompt(prompt.id)} disabled={deletingIds.has(prompt.id)}>{deletingIds.has(prompt.id) ? '削除中...' : '削除'}</button>
        </div>
      </div>
      {/each}
    </div>
  {:else if view === 'edit'}
    <PromptEditor
      {currentData}
      promptId={editingPromptId}
      on:message={(e) => dispatch('message', e.detail)}
      on:dataUpdated={(e) => dispatch('dataUpdated', e.detail)}
      on:promptSelectionReset={() => dispatch('promptSelectionReset')}
      on:back={backToList}
    />
  {/if}
</div>

<!-- モーダルは廃止（エディタページへ遷移） -->

<style>
  .prompts-container {
    padding: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .prompt-header {
    margin-bottom: 0;
  }

  .prompt-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    flex: 1;
    overflow-y: auto;
  }

  .prompt-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 15px;
    background-color: #f8f9fa;
    border-radius: 8px;
    transition: background-color 0.2s ease;
  }

  .prompt-item:hover {
    background-color: #e9ecef;
  }

  .prompt-info h4 {
    font-size: 14px;
    margin-bottom: 5px;
    color: #212529;
  }

  .prompt-info p {
    font-size: 12px;
    color: #6c757d;
    margin: 0;
  }

  .prompt-actions {
    display: flex;
    gap: 10px;
  }

  .edit-button,
  .delete-button {
    padding: 6px 12px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .edit-button {
    background-color: #28a745;
    color: white;
  }

  .edit-button:hover {
    background-color: #218838;
  }

  .delete-button {
    background-color: #dc3545;
    color: white;
  }

  .delete-button:hover {
    background-color: #c82333;
  }

  .primary-button {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .primary-button {
    background-color: #007bff;
    color: white;
  }

  .primary-button:hover {
    background-color: #0056b3;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  /* 旧モーダル関連のスタイルは未使用のため削除 */
</style> 