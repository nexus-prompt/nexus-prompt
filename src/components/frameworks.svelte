<script lang="ts">
  import type { MessageType } from '../types';
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable } from 'svelte/store';
  import { appData } from '../stores';
  import { FrameworkViewModel, createFrameworkViewModel, toFrameworkDsl } from '../promptops/dsl/framework/renderer';
  
  // Local state
  const frameworkViewModel = writable<FrameworkViewModel>({
    id: '',
    name: '',
    content: '',
    metadata: {}
  });
  let isLoading: boolean = false;
  
  // Constants
  const MAX_FRAMEWORK_CONTENT_LENGTH = 20000;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    message: { text: string; type: MessageType };
    promptSelectionReset: void;
  }>();

  onMount(() => {
    console.log('currentData.frameworks[0]?.content', $appData?.frameworks[0]?.content);
    const vm = createFrameworkViewModel($appData?.frameworks[0]?.content);
    frameworkViewModel.set(vm);
  });

  async function saveFramework(): Promise<void> {
    if (!$frameworkViewModel.content.trim()) {
      dispatch('message', { text: 'フレームワーク内容を入力してください', type: 'error' });
      return;
    }

    if ($frameworkViewModel.content.length > MAX_FRAMEWORK_CONTENT_LENGTH) {
      dispatch('message', { text: `フレームワーク内容は${MAX_FRAMEWORK_CONTENT_LENGTH.toLocaleString()}文字以内で入力してください`, type: 'error' });
      return;
    }

    try {
      isLoading = true;

      if ($appData?.frameworks[0]) {
        appData.update((current) => {
          if (!current?.frameworks?.[0]) return current;

          const now = new Date().toISOString();
          const fw = toFrameworkDsl($frameworkViewModel);
          const updatedFrameworks = current.frameworks.map((f, idx) =>
            idx === 0 ? { ...f, content: fw, updatedAt: now } : f
          );

          return { ...current, frameworks: updatedFrameworks };
        });
        
        dispatch('promptSelectionReset');
        dispatch('message', { text: 'フレームワークを保存しました', type: 'success' });
      }
    } catch (error) {
      console.error('フレームワークの保存エラー:', error);
      dispatch('message', { text: 'フレームワークの保存に失敗しました', type: 'error' });
    } finally {
      isLoading = false;
    }
  }
</script>

<div class="framework-container">
  <div class="form-group">
    <label for="frameworkContent">プロンプト生成フレームワーク</label>
    <textarea 
      id="frameworkContent"
      bind:value={$frameworkViewModel.content}
      disabled={isLoading}
      rows="22" 
      data-testid="framework-content-input"
      placeholder="フレームワーク情報を入力してください（例：コンテキスト、条件設定、対象など）">
    </textarea>
  </div>
  <button 
    id="saveFramework" 
    class="primary-button" 
    on:click={saveFramework} 
    disabled={isLoading}
    data-testid="save-framework-button"
  >
    {#if isLoading}保存中...{:else}保存{/if}
  </button>
</div>

<style>
  .framework-container {
    padding: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
    flex: 1;
  }

  .form-group label {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
  }

  .form-group textarea {
    flex: 1;
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    resize: vertical;
    min-height: 60px;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }

  .form-group textarea:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
  }

  .primary-button {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    align-self: flex-end;
    background-color: #007bff;
    color: white;
  }

  .primary-button:hover {
    background-color: #0056b3;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }
</style> 