<script lang="ts">
  import type { AppData, MessageType, SnapshotData } from '../types';
  import { storageService } from '../services/storage';
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';

  // Props
  export let currentData: AppData;
  export let currentSnapshot: SnapshotData;
  export let selectedPromptIdFromParent: string 

  // Local state
  const userPrompt = writable(currentSnapshot.userPrompt);
  const selectedPromptId = writable(selectedPromptIdFromParent);
  const selectedModelId = writable(currentSnapshot.selectedModelId);
  const resultArea = writable(currentSnapshot.resultArea);
  let isLoading: boolean = false;
  let isThrottled = false;
  let hasPendingChanges = false;

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    message: { text: string; type: MessageType };
    dataUpdated: { data: AppData };
    snapshotUpdated: { snapshot: SnapshotData };
    switchTab: { tabName: string };
  }>();

  // コンポーネントがマウントされた時に、保存されている下書きを読み込む
  onMount(async () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  // 親の onMount 完了後に子の初期化を強制したいケースへの対策：
  // 親から渡される currentData/currentSnapshot は初期化後に変わる可能性があるため、
  // 初回 tick 後に実行することで、親の初期化完了を待つ。
  import { tick } from 'svelte';
  onMount(async () => {
    await tick();
  });

  async function improvePrompt(): Promise<void> {
    if (!$userPrompt.trim() || !$selectedPromptId) {
      dispatch('message', { text: 'プロンプトとLLMプロンプトの両方を入力・選択してください', type: 'error' });
      return;
    }

    if (!$selectedModelId) {
      dispatch('message', { text: '実行モデルを選択してください', type: 'error' });
      return;
    }

    const selectElement = document.getElementById('modelSelect') as HTMLSelectElement;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const selectedProviderName = selectedOption.getAttribute('data-provider-name') || '';
    const selectedModelName = selectedOption.getAttribute('data-model-name') || '';

    const selectedPrompt = currentData.prompts.find(p => p.id === $selectedPromptId);

    if (!selectedPrompt) {
      dispatch('message', { text: '選択されたプロンプトが見つかりません', type: 'error' });
      return;
    }

    try {
      isLoading = true;
      dispatch('message', { text: 'プロンプトを改善中です...', type: 'info' });

      const response = await chrome.runtime.sendMessage({
        type: 'IMPROVE_PROMPT',
        payload: {
          providerName: selectedProviderName,
          modelName: selectedModelName,
          userPrompt: $userPrompt,
          selectedPrompt: selectedPrompt.content,
          frameworkContent: currentData.frameworks[0].content.content
        }
      });

      if (response.success) {
        const result = response.data;
        resultArea.set(result);

         // イミュータブルな更新
        const newSnapshot = structuredClone(currentSnapshot);
        
        newSnapshot.userPrompt = $userPrompt;
        newSnapshot.selectedPromptId = $selectedPromptId;
        newSnapshot.resultArea = result;
        newSnapshot.selectedModelId = $selectedModelId;

        dispatch('dataUpdated', { data: currentData });
        dispatch('snapshotUpdated', { snapshot: newSnapshot });
        await storageService.saveAppData(currentData);
        await storageService.saveSnapshot(newSnapshot);
        dispatch('message', { text: 'プロンプトの改善が完了しました', type: 'success' });
      } else {
        console.warn(response.error);
        if (response.error.includes('APIキーが設定されていません')) {
          dispatch('message', { text: 'APIキーを設定してください', type: 'error' });
          // 親へのイベント通知とあわせて、スナップショットも直接更新して確実にタブを切り替える
          dispatch('switchTab', { tabName: 'settings' });
          try {
            const newSnapshot = structuredClone(currentSnapshot);
            newSnapshot.activeTab = 'settings';
            await storageService.saveSnapshot(newSnapshot);
            dispatch('snapshotUpdated', { snapshot: newSnapshot });
          } catch (e) {
            // 失敗しても致命的ではないため握りつぶす
          }
        } else if (response.error.includes('fetch')) {
          dispatch('message', { text: 'ネットワーク接続に問題があるようです。接続を確認してください。', type: 'error' });
        } else {
          dispatch('message', { text: `エラー: ${response.error}`, type: 'error' });
        }
      }
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      dispatch('message', { text: 'プロンプトの改善中に予期せぬエラーが発生しました。', type: 'error' });
    } finally {
      isLoading = false;
    }
  }

  function copyResult(): void {
    if (!$resultArea.trim()) {
      dispatch('message', { text: 'コピーする内容がありません', type: 'error' });
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText($resultArea)
        .then(() => {
          dispatch('message', { text: 'クリップボードにコピーしました', type: 'success' });
        })
        .catch((err) => {
          console.warn('クリップボードへのコピーに失敗:', err);
          fallbackCopy();
        });
    } else {
      fallbackCopy();
    }
  }

  function fallbackCopy(): void {
    const textarea = document.getElementById('resultArea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.value = $resultArea;
      textarea.select();
      try {
        document.execCommand('copy');
        dispatch('message', { text: 'クリップボードにコピーしました', type: 'success' });
      } catch (err) {
        console.warn('コピーに失敗:', err);
        dispatch('message', { text: 'コピーに失敗しました', type: 'error' });
      }
    }
  }

  function resetFields(): void {
    userPrompt.set('');
    resultArea.set('');
    selectedPromptId.set('');

    const newSnapshot = structuredClone(currentSnapshot);

    newSnapshot.userPrompt = '';
    newSnapshot.selectedPromptId = '';
    newSnapshot.resultArea = '';
    storageService.saveSnapshot(newSnapshot); 
    dispatch('snapshotUpdated', { snapshot: newSnapshot });
    dispatch('message', { text: 'フィールドをリセットしました', type: 'success' });
  }

  const saveSnapshot = async () => {
    const newSnapshot = structuredClone(currentSnapshot);
    await storageService.saveSnapshot(newSnapshot);
    dispatch('snapshotUpdated', { snapshot: newSnapshot });
    hasPendingChanges = false;
  };

  const throttledSave = () => {
    if (isThrottled) {
      hasPendingChanges = true;
      return;
    }

    isThrottled = true;
    saveSnapshot();

    setTimeout(() => {
      isThrottled = false;
      if (hasPendingChanges) {
        throttledSave(); // 保存されなかった最後の変更を保存
      }
    }, 500);
  };

  // 入力があるたびに呼び出される関数
  const handleInput = (event: Event) => {
    const target = event.target as HTMLTextAreaElement;
    if (target.id === "userPrompt") {
      currentSnapshot.userPrompt = target.value;
    } else if (target.id === "promptSelect") {
      currentSnapshot.selectedPromptId = target.value;
    } else if (target.id === "resultArea") {
      currentSnapshot.resultArea = target.value;
    }else if (target.id === "modelSelect") {
      currentSnapshot.selectedModelId = target.value;
    }
    throttledSave();
  };

  const handleVisibilityChange = () => {
    if (document.visibilityState === 'hidden') {
      saveSnapshot();
    }
  };

  onDestroy(() => {
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    if (hasPendingChanges) {
      saveSnapshot();
    }
  });
</script>

<div class="improvement-container">
  <div class="top-panel">
    <div class="form-group">
      <select 
        id="modelSelect" 
        data-testid="model-select"
        class="model-select"
        bind:value={$selectedModelId}
        on:input={handleInput}
        disabled={isLoading}>
        <option value="">実行モデルを選択してください</option>
        {#each currentData.providers as provider}
          {#each provider.models.filter(model => model.enabled) as model}
            <option value={model.id} data-provider-name={provider.name} data-model-name={model.name}>
              {provider.displayName} - {model.name}
            </option>
          {/each}
        {/each}
      </select>
    </div>
  </div>
  <div class="main-layout">
    <div class="left-panel">
      <div class="form-group">
        <div class="label-with-reset">
          <label for="userPrompt">LLMで実行するプロンプト</label>
          <button class="reset-button" on:click={resetFields} disabled={isLoading}>リセット</button>
        </div>
        <textarea 
          id="userPrompt"
          data-testid="user-prompt-input"
          bind:value={$userPrompt}
          disabled={isLoading}
          rows="15" 
          on:input={handleInput}
          placeholder="改善したいプロンプトを入力してください">
        </textarea>
      </div>
      <div class="form-group">
        <label for="promptSelect">登録済みLLMプロンプト</label>
        <select 
          id="promptSelect" 
          data-testid="prompt-select"
          bind:value={$selectedPromptId}
          disabled={isLoading}
          on:input={handleInput}>
          <option value="">選択してください</option>
          {#each currentData.prompts as prompt}
            <option value={prompt.id}>
              {prompt.content.name || prompt.content.template.substring(0, 30) + '...'}
            </option>
          {/each}
        </select>
      </div>
      <button id="applyButton" data-testid="apply-button" class="primary-button" on:click={improvePrompt} disabled={isLoading}>
        {#if isLoading}処理中...{:else}適用{/if}
      </button>
    </div>
    <div class="right-panel">
      <div class="form-group">
        <label for="resultArea">改善されたプロンプト</label>
        <textarea 
          id="resultArea"
          data-testid="result-area"
          bind:value={$resultArea}
          rows="20" 
          on:input={handleInput}
          placeholder="改善結果がここに表示されます">
        </textarea>
      </div>
      <button id="copyButton" class="secondary-button" on:click={copyResult} disabled={!resultArea}>コピー</button>
    </div>
  </div>

  <div class="footer-link">
    <a href="https://www.buymeacoffee.com/nexus.prompt" target="_blank" rel="noopener noreferrer" title="この拡張機能の開発をサポート">
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
      <span>Support this extension</span>
    </a>
  </div>
</div>

<style>
  .improvement-container {
    padding: 0;
    height: 100%;
    display: flex;
    flex-direction: column;
    position: relative;
  }

  .top-panel {
    display: flex;
    justify-content: flex-start;
    border-bottom: 1px solid #dee2e6;
    margin-bottom: 10px;
  }

  .top-panel .form-group {
    min-width: 300px;
  }

  .main-layout {
    display: flex;
    gap: 20px;
    height: 100%;
    flex: 1;
  }

  .left-panel,
  .right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 15px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .form-group:first-child {
    flex: 1;
  }

  .form-group label {
    font-weight: 600;
    color: #495057;
    font-size: 13px;
  }

  .form-group textarea,
  .form-group select {
    padding: 10px;
    border: 1px solid #ced4da;
    border-radius: 6px;
    font-size: 14px;
    font-family: inherit;
    transition: border-color 0.15s ease-in-out, box-shadow 0.15s ease-in-out;
  }
  .form-group select.model-select {
    padding: 2px;
  }
  
  .form-group textarea {
    resize: vertical;
    min-height: 60px;
  }

  .left-panel .form-group:first-child textarea {
    flex: 1;
  }

  .right-panel .form-group textarea {
    flex: 1;
  }

  .form-group textarea:focus,
  .form-group select:focus {
    outline: none;
    border-color: #007bff;
    box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
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
    align-self: flex-end;
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
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .label-with-reset {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .reset-button {
    padding: 4px 12px;
    border: 1px solid #dc3545;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 500;
    color: #dc3545;
    background-color: transparent;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .reset-button:hover {
    background-color: #dc3545;
    color: white;
    transform: translateY(-1px);
    box-shadow: 0 2px 4px rgba(220, 53, 69, 0.2);
  }

  .reset-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }

  .reset-button:disabled:hover {
    background-color: transparent;
    color: #dc3545;
  }

  .footer-link {
    position: absolute;
    bottom: 8px;
    right: 200px;
    font-size: 12px;
  }

  .footer-link a {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #868e96;
    text-decoration: none;
    transition: color 0.2s ease;
  }

  .footer-link a:hover {
    color: #007bff;
  }

  .footer-link svg {
    width: 16px;
    height: 16px;
  }
</style> 