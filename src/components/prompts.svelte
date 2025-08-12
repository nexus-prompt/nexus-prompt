<script lang="ts">
  import { storageService } from '../services/storage';
  import { fade, fly } from 'svelte/transition';
  import { flip } from 'svelte/animate';
  import { appData, snapshotData, viewContext, isInitialized, showToast, capabilities, entitlements } from '../stores';
  import PromptEditor from './prompt-editor.svelte';

  // Local state
  let view = $state<'list' | 'edit'>('list');
  let editingPromptId = $state<string | null>(null);
  let deletingIds = $state<Set<string>>(new Set());
  let handledSidepanelInit = $state(false);
  
  // Event handler
  let { promptSelectionReset } = $props();

  // Derived
  const promptListSorted = $derived(
    [...($appData?.prompts ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  );

  // Derived: 環境フラグはストアから参照
  const canUseSidePanel = $derived($capabilities.canUseSidePanel);

  // Constants
  const MAX_PROMPT_COUNT = 20;

  // 親の onMount 後に viewContext が設定されるため、変化を一度だけ拾う
  $effect(() => {
    if ($isInitialized && !handledSidepanelInit && $viewContext === 'sidepanel' && $snapshotData?.editingTarget.type === 'prompt') {
      handledSidepanelInit = true;
      editingPromptId = $snapshotData.editingTarget.id || null;
      view = 'edit';
      (async () => {
        try {
          await storageService.clearEditingTarget();
        } finally {
          snapshotData.update(current => current ? { ...current, editingTarget: { type: null, id: '' } } : null);
        }
      })();
    }
  });

  function openEditor(promptId: string | null = null): void {
    editingPromptId = promptId;
    view = 'edit';
  }

  async function openInSidePanel(targetId: string | null): Promise<void> {
    // サイドパネル内 または API 不可ならフォールバック
    if ($viewContext === 'sidepanel' || !canUseSidePanel) {
      openEditor(targetId);
      return;
    }

    try {
      await storageService.saveActiveTab('prompts');
      if (targetId === null) {
        await storageService.saveEditingTarget('prompt', '');
      } else {
        await storageService.saveEditingTarget('prompt', targetId);
      }

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
      openEditor(targetId);
    }
  }

  // 新規作成時にサイドパネルでエディタを開く
  async function openNewEditorInSidePanel(): Promise<void> {
    if ($entitlements.isFree && promptListSorted.length >= MAX_PROMPT_COUNT) {
      showToast(`フリープランではプロンプトは${MAX_PROMPT_COUNT}個までしか作成できません。プランをアップグレードしてください。`, 'error');
      return;
    }
    await openInSidePanel(null);
  }

  async function deletePrompt(promptId: string): Promise<void> {
    if (confirm('このプロンプトを削除してもよろしいですか？')) {
      try {
        deletingIds.add(promptId);
        deletingIds = new Set(deletingIds);

        appData.update(current => {
          if (!current) return null;
          // 削除対象のプロンプトのorderを取得
          const deletedPrompt = current.prompts.find(p => p.id === promptId);
          const deletedOrder = deletedPrompt?.order || 0;
          
          // プロンプトを削除
          current.prompts = current.prompts.filter(p => p.id !== promptId);
          
          // 削除されたorder以降のプロンプトのorderを-1する
          current.prompts.forEach(prompt => {
            if (prompt.order > deletedOrder && prompt.order > 1) {
              prompt.order -= 1;
            }
          });
          return current;
        });
        
        showToast('プロンプトを削除しました', 'success');
        promptSelectionReset();
      } catch (error) {
        console.error('プロンプト削除エラー:', error);
        showToast('プロンプトの削除に失敗しました', 'error');
      } finally {
        deletingIds.delete(promptId);
        deletingIds = new Set(deletingIds);
      }
    }
  }

  function backToList(): void {
    view = 'list';
    editingPromptId = null;
  }
</script>

<div class="prompts-container">
  {#if view === 'list'}
    <div in:fade={{ duration: 200 }}>
      <div class="prompt-header">
        <button id="newPromptButton" class="primary-button" data-testid="new-prompt-button" onclick={openNewEditorInSidePanel}>新規作成</button>
      </div>
      <div id="promptList" data-testid="prompt-list" class="prompt-list">
        {#each promptListSorted as prompt (prompt.id)}
        <div class="prompt-item" data-testid="prompt-item" in:fly={{ y: 20, duration: 250 }} animate:flip>
          <div class="prompt-info">
            <h4>{prompt.content.name}</h4>
            <p>{prompt.content.template.substring(0, 50)}...</p>
          </div>
          <div class="prompt-actions">
            <button class="edit-button" onclick={() => openInSidePanel(prompt.id)} disabled={deletingIds.has(prompt.id)}>編集</button>
            <button class="delete-button" onclick={() => deletePrompt(prompt.id)} disabled={deletingIds.has(prompt.id)}>{deletingIds.has(prompt.id) ? '削除中...' : '削除'}</button>
          </div>
        </div>
        {/each}
      </div>
    </div>
  {:else if view === 'edit'}
    <div in:fade={{ duration: 200 }}>
      <PromptEditor
        promptId={editingPromptId}
        promptSelectionReset={promptSelectionReset}
        backToList={backToList}
      />
    </div>
  {/if}
</div>

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