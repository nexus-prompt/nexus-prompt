<script lang="ts">
  import type { ModelInfo } from '../types';
  import { appData, snapshotData, showToast, viewContext } from '../stores';
  import { onMount, onDestroy } from 'svelte';
  import { writable } from 'svelte/store';
  import { autosize } from '../actions/autosize';

  // Event handler, Props
  let { switchTab, selectedPromptIdFromParent } = $props();

  // Local state
  const userPrompt = writable($snapshotData?.userPrompt || '');
  const selectedPromptId = writable(selectedPromptIdFromParent);
  const selectedModelId = writable($snapshotData?.selectedModelId || '');
  const resultArea = writable($snapshotData?.resultArea || '');
  let isLoading = $state(false);
  let isThrottled = $state(false);
  let hasPendingChanges = $state(false);

  // コンポーネントがマウントされた時に、保存されている下書きを読み込む
  onMount(async () => {
    document.addEventListener('visibilitychange', handleVisibilityChange);
  });

  async function improvePrompt(): Promise<void> {
    if (!$userPrompt.trim() || !$selectedPromptId) {
      showToast('プロンプトとLLMプロンプトの両方を入力・選択してください', 'error');
      return;
    }

    if (!$selectedModelId) {
      showToast('実行モデルを選択してください', 'error');
      return;
    }

    const selectElement = document.getElementById('modelSelect') as HTMLSelectElement;
    const selectedOption = selectElement.options[selectElement.selectedIndex];
    const selectedProviderName = selectedOption.getAttribute('data-provider-name') || '';
    const selectedModelName = selectedOption.getAttribute('data-model-name') || '';

    const selectedPrompt = $appData?.prompts.find(p => p.id === $selectedPromptId);

    if (!selectedPrompt) {
      showToast('選択されたプロンプトが見つかりません', 'error');
      return;
    }

    try {
      isLoading = true;
      showToast('プロンプトを改善中です...', 'info');

      const response = await chrome.runtime.sendMessage({
        type: 'IMPROVE_PROMPT',
        payload: {
          providerName: selectedProviderName,
          modelName: selectedModelName,
          userPrompt: $userPrompt,
          selectedPrompt: selectedPrompt.content,
          frameworkContent: $appData?.frameworks[0].content.content
        }
      });

      if (response.success) {
        const result = response.data;
        resultArea.set(result);
        snapshotData?.update(current => current ? { ...current, userPrompt: $userPrompt, selectedPromptId: $selectedPromptId, resultArea: result, selectedModelId: $selectedModelId } : current);
        showToast('プロンプトの改善が完了しました', 'success');
      } else {
        console.warn(response.error);
        if (response.error.includes('APIキーが設定されていません')) {
          showToast('APIキーを設定してください', 'error');
          // 親へのイベント通知とあわせて、スナップショットも直接更新して確実にタブを切り替える
          switchTab('settings');
          try {
            snapshotData?.update(current => current ? { ...current, activeTab: 'settings' } : current);
          } catch (e) {
            // 失敗しても致命的ではないため握りつぶす
          }
        } else if (response.error.includes('fetch')) {
          showToast('ネットワーク接続に問題があるようです。接続を確認してください。', 'error');
        } else {
          showToast(`エラー: ${response.error}`, 'error');
        }
      }
    } catch (error) {
      console.error('メッセージ送信エラー:', error);
      showToast('プロンプトの改善中に予期せぬエラーが発生しました。', 'error');
    } finally {
      isLoading = false;
    }
  }

  function copyResult(): void {
    if (!$resultArea.trim()) {
      showToast('コピーする内容がありません', 'error');
      return;
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText($resultArea)
        .then(() => {
          showToast('クリップボードにコピーしました', 'success');
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
        showToast('クリップボードにコピーしました', 'success');
      } catch (err) {
        console.warn('コピーに失敗:', err);
        showToast('コピーに失敗しました', 'error');
      }
    }
  }

  function resetFields(): void {
    userPrompt.set('');
    resultArea.set('');
    selectedPromptId.set('');

    snapshotData?.update(current => current ? { ...current, userPrompt: '', selectedPromptId: '', resultArea: '' } : current);
    showToast('フィールドをリセットしました', 'success');
  }

  // ストア更新時に自動保存されるため、明示保存は不要
  const saveSnapshot = async () => {
    snapshotData?.update(current => current ? {
      ...current,
      userPrompt: $userPrompt,
      selectedPromptId: $selectedPromptId,
      resultArea: $resultArea,
      selectedModelId: $selectedModelId
    } : current);
    hasPendingChanges = false;
  };

  const throttledSave = () => {
    if (isThrottled) {
      hasPendingChanges = true;
      return;
    }

    isThrottled = true;
    void saveSnapshot(); // 先頭保存

    setTimeout(() => {
      isThrottled = false;
      if (hasPendingChanges) {
        void saveSnapshot(); // 末尾保存（取りこぼし防止）
      }
    }, 500);
  };

  // 入力があるたびに呼び出される関数（ローカル状態は bind で更新されるため、保存のみスロットリング）
  const handleInput = () => {
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
  <div class="top-layout">
    <div class="form-group">
      <select 
        id="modelSelect" 
        data-testid="model-select"
        class="model-select"
        bind:value={$selectedModelId}
        oninput={handleInput}
        disabled={isLoading}>
        <option value="">実行モデルを選択してください</option>
        {#each $appData?.providers || [] as provider}
          {#each provider?.models.filter((model: ModelInfo) => model.enabled) as model}
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
          <button class="reset-button" onclick={resetFields} disabled={isLoading}>リセット</button>
        </div>
        <textarea 
          id="userPrompt"
          data-testid="user-prompt-input"
          bind:value={$userPrompt}
          disabled={isLoading}
          use:autosize={{ maxRows: 20, minRows: 10, fixedRows: $viewContext === 'popup' ? 13 : undefined }}
          oninput={handleInput}
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
          oninput={handleInput}>
          <option value="">選択してください</option>
          {#each $appData?.prompts || [] as prompt}
            <option value={prompt.id}>
              {prompt.content.name || prompt.content.template.substring(0, 30) + '...'}
            </option>
          {/each}
        </select>
      </div>
      <div class="input-button-group">
        <button id="applyButton" data-testid="apply-button" class="primary-button" onclick={improvePrompt} disabled={isLoading}>
          {#if isLoading}処理中...{:else}適用{/if}
        </button>
      </div>
    </div>
    <div class="right-panel">
      <div class="form-group ">
        <label for="resultArea" class="label-with-improved-prompt">改善されたプロンプト</label>
        <textarea 
          id="resultArea"
          data-testid="result-area"
          class="result-area"
          bind:value={$resultArea}
          use:autosize={{ maxRows: 20, minRows: 7, fixedRows: $viewContext === 'popup' ? 17 : undefined }}
          oninput={handleInput}
          placeholder="改善結果がここに表示されます">
        </textarea>
      </div>

      <div class="input-button-group">
        <a href="https://www.buymeacoffee.com/nexus.prompt" target="_blank" rel="noopener noreferrer" title="この拡張機能の開発をサポート">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"></path><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path><line x1="6" y1="1" x2="6" y2="4"></line><line x1="10" y1="1" x2="10" y2="4"></line><line x1="14" y1="1" x2="14" y2="4"></line></svg>
          <span>Support this extension</span>
        </a>
        <button id="copyButton" class="secondary-button" onclick={copyResult} disabled={!resultArea}>コピー</button>
      </div>
    </div>
  </div>
</div>

<style>
  @reference "tailwindcss";
  .top-layout {
    @apply justify-start border-b border-gray-200 mb-2;
  }
  .top-layout .form-group { 
    @apply min-w-[300px]; 
  }
  .improvement-container {
    @apply flex flex-col p-0 h-full relative;
  }

  @media (min-width: 768px) {
    .main-layout {
      @apply flex flex-row gap-5 h-full;
    }
  }
  @media (max-width: 768px) {
    .main-layout {
      @apply flex flex-row h-full;
    }
  }

  .left-panel, .right-panel {
    @apply basis-0 min-w-0 flex-1 flex flex-col gap-3;
  }

  @media (max-width: 768px) {
    .main-layout {
      @apply flex-col;
    }
    .left-panel, .right-panel {
      @apply w-full;
    }
  } 

  .left-panel .form-group textarea,
  .right-panel .form-group textarea {
    @apply flex-1; 
  }

  .model-select { 
    @apply p-0.5;
  }

  .label-with-improved-prompt {
    @apply p-[5];
  }
  .label-with-reset {
    @apply flex justify-between items-center;
  }
  .reset-button {
    @apply px-3 py-1 border border-red-500 rounded-md text-sm font-medium text-red-500 bg-transparent cursor-pointer transition-all duration-200;
  }
  .reset-button:hover {
    @apply bg-red-500 text-white -translate-y-px shadow-sm;
  }
  .reset-button:disabled {
    @apply opacity-50 cursor-not-allowed -translate-y-0 shadow-none;
  }
  .reset-button:disabled:hover {
    @apply bg-transparent text-red-500;
  }

  .right-panel .input-button-group { 
    @apply flex items-center justify-between text-sm w-full;
  }
  .right-panel .input-button-group a { 
    @apply flex items-center gap-1.5 text-gray-500 no-underline transition-colors;
  }
  .right-panel .input-button-group a:hover { 
    @apply text-blue-500;
  }
  .right-panel .input-button-group svg { @apply w-4 h-4; }
</style>
