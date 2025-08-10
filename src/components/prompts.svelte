<script lang="ts">
  import type { AppData, Prompt, MessageType } from '../types';
  import { storageService } from '../services/storage';
  import { createEventDispatcher } from 'svelte';
  import { writable } from 'svelte/store';
  import { PromptViewModel, createPromptViewModel, toPromptDsl } from '../promptops/dsl/prompt/renderer';
  
  // Props
  export let currentData: AppData;

  // Local state
  const promptViewModel = writable<PromptViewModel>({
    id: '',
    name: '',
    template: '',
    fields: [],
    frameworkRef: '',
    metadata: {},
  });
  let showModal: boolean = false;
  let modalTitle: string = 'LLMプロンプト編集';
  let editingPromptId: string | null = null;
  let isSaving: boolean = false;
  let deletingIds: Set<string> = new Set();
  
  // Constants
  const MAX_PROMPT_CONTETNT_LENGTH = 10000;
  const MAX_PROMPT_NAME_LENGTH = 200;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    message: { text: string; type: MessageType };
    dataUpdated: { data: AppData };
    promptSelectionReset: void;
  }>();

  // Reactive: プロンプトリスト
  $: promptList = currentData.prompts || [];

  function openPromptModal(promptId: string | null = null): void {
    editingPromptId = promptId;
    
    if (promptId) {
      const prompt = currentData.prompts.find(p => p.id === promptId);
      if (prompt) {
        const vm = createPromptViewModel(prompt.content);
        promptViewModel.set(vm);
      }
    } else {
      modalTitle = 'LLMプロンプト新規作成';
      promptViewModel.set({
        id: '',
        name: '',
        template: '',
        fields: [],
        frameworkRef: '',
        metadata: {}
      });
    }
    
    showModal = true;
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

    if (!($promptViewModel.name && $promptViewModel.name.trim())) {
      dispatch('message', { text: `プロンプト名を入力してください`, type: 'error' });
      return;
    }

    if ($promptViewModel.name && $promptViewModel.name.length > MAX_PROMPT_NAME_LENGTH) {
      dispatch('message', { text: `プロンプト名は${MAX_PROMPT_NAME_LENGTH}文字以内で入力してください`, type: 'error' });
      return;
    }

    try {
      isSaving = true;
      // イミュータブルな更新
      const newData = structuredClone(currentData);
      
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
      
      closeModal();
    } catch (error) {
      console.error('プロンプト保存エラー:', error);
      dispatch('message', { text: 'プロンプトの保存に失敗しました', type: 'error' });
    } finally {
      isSaving = false;
    }
  }

  function closeModal(): void {
    showModal = false;
    editingPromptId = null;
    promptViewModel.set({
      id: '',
      name: '',
      template: '',
      fields: [],
      frameworkRef: '',
      metadata: {}
    });
  }
</script>

<div class="prompts-container">
  <div class="prompt-header">
    <button id="newPromptButton" class="primary-button" data-testid="new-prompt-button" on:click={() => openPromptModal()}>新規作成</button>
  </div>
  <div id="promptList" data-testid="prompt-list" class="prompt-list">
    {#each promptList as prompt}
    <div class="prompt-item" data-testid="prompt-item">
      <div class="prompt-info">
        <h4>{prompt.content.name}</h4>
        <p>{prompt.content.template.substring(0, 50)}...</p>
      </div>
      <div class="prompt-actions">
        <button class="edit-button" on:click={() => openPromptModal(prompt.id)} disabled={deletingIds.has(prompt.id)}>編集</button>
        <button class="delete-button" on:click={() => deletePrompt(prompt.id)} disabled={deletingIds.has(prompt.id)}>{deletingIds.has(prompt.id) ? '削除中...' : '削除'}</button>
      </div>
    </div>
    {/each}
  </div>
</div>

<!-- モーダル -->
{#if showModal}
<div id="promptModal" data-testid="prompt-modal" class="modal" style="display: block;">
  <div class="modal-content">
    <div class="modal-header">
      <h3 id="modalTitle">{modalTitle}</h3>
      <button class="close" on:click={closeModal} type="button" aria-label="Close modal">&times;</button>
    </div>
    <div class="modal-body">
      <div class="form-group">
        <label for="promptName">プロンプト名</label>
        <input 
          type="text" 
          id="promptName"
          data-testid="prompt-name-input"
          bind:value={$promptViewModel.name}
          placeholder="プロンプトの名前を入力">
      </div>
      <div class="form-group">
        <label for="promptContent">プロンプト内容</label>
        <textarea 
          id="promptContent"
          data-testid="prompt-content-input"
          bind:value={$promptViewModel.template}
          rows="8" 
          placeholder="LLMプロンプトを入力">
        </textarea>
      </div>
    </div>
    <div class="modal-footer">
      <button id="savePrompt" class="primary-button" data-testid="save-prompt-button" on:click={savePromptModal} disabled={isSaving}>{isSaving ? '保存中...' : '保存'}</button>
      <button id="cancelPrompt" class="secondary-button" data-testid="cancel-prompt-button" on:click={closeModal} disabled={isSaving}>キャンセル</button>
    </div>
  </div>
</div>
{/if}

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

  .primary-button,
  .secondary-button {
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

  .secondary-button {
    background-color: #6c757d;
    color: white;
  }

  .secondary-button:hover {
    background-color: #5a6268;
  }

  .modal {
    position: fixed;
    z-index: 1000;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
    animation: fadeIn 0.3s ease;
  }

  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .modal-content {
    background-color: white;
    margin: 5% auto;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }

  @keyframes slideIn {
    from {
      transform: translateY(-50px);
      opacity: 0;
    }
    to {
      transform: translateY(0);
      opacity: 1;
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
  }

  .modal-header h3 {
    margin: 0;
    color: #333;
  }

  .close {
    background: none;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: #999;
    padding: 0;
    margin: 0;
    line-height: 1;
  }

  .close:hover {
    color: #000;
  }

  .modal-body {
    padding: 20px;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding: 20px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 15px;
  }

  .form-group label {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
  }

  .form-group input,
  .form-group textarea {
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  }

  .form-group textarea {
    resize: vertical;
    min-height: 60px;
  }
</style> 