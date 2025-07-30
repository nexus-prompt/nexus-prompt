<script lang="ts">
  import type { AppData, MessageType } from '../types';
  import { storageService } from '../services/storage';
  import { ImportExportService } from '../services/import-export';
  import { createEventDispatcher, onMount } from 'svelte';
  import { writable } from 'svelte/store';

  // Local state
  const geminiApiKey = writable('');
  const openaiApiKey = writable('');
  const anthropicApiKey = writable('');
  let isLoading: boolean = false;
  let isImportExportLoading: boolean = false;
  
  // Constants
  const MAX_API_KEY_LENGTH = 300;

  // Services
  const importExportService = new ImportExportService();

  // Event dispatcher
  const dispatch = createEventDispatcher<{
    message: { text: string; type: MessageType };
    dataUpdated: { data: AppData };
  }>();

  // APIキーの初期化
  onMount(async () => {
    try {
      geminiApiKey.set(await storageService.getApiKey('Gemini') || '');
      openaiApiKey.set(await storageService.getApiKey('OpenAI') || '');
      anthropicApiKey.set(await storageService.getApiKey('Anthropic') || '');
    } catch (error) {
      console.error('APIキーの読み込みに失敗:', error);
    }
  });

  /**
   * APIキー保存
   */
  async function saveApiKey(event: Event): Promise<void> {
    const target = event.target as HTMLElement;
    const providerName = target.getAttribute('data-provider-name') || '';

    let apiKey = '';
    if (providerName === 'Gemini') {
      apiKey = $geminiApiKey;
    } else if (providerName === 'OpenAI') {
      apiKey = $openaiApiKey;
    } else if (providerName === 'Anthropic') {
      apiKey = $anthropicApiKey;
    }

    if (!apiKey.trim()) {
      dispatch('message', { text: 'APIキーを入力してください', type: 'error' });
      return;
    }

    if (apiKey.length > MAX_API_KEY_LENGTH) {
      dispatch('message', { text: `APIキーは${MAX_API_KEY_LENGTH}文字以内で入力してください`, type: 'error' });
      return;
    }

    try {
      isLoading = true;
      // 暗号化してStorageServiceに保存
      const success = await storageService.setApiKey(providerName, apiKey);

      if (success) {
        dispatch('message', { text: 'APIキーを保存しました', type: 'success' });
      } else {
        dispatch('message', { text: 'APIキーの保存に失敗しました', type: 'error' });
      }
    } catch (error) {
      console.error('APIキーの保存中に予期せぬエラー:', error);
      dispatch('message', { text: 'APIキーの保存に失敗しました', type: 'error' });
    } finally {
      isLoading = false;
    }
  }

  async function exportData(): Promise<void> {
    try {
      isImportExportLoading = true;
      const jsonData = await importExportService.exportData();
      
      // ファイルダウンロードの実行
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-prompt-frameworks-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      dispatch('message', { text: 'フレームワークデータをエクスポートしました', type: 'success' });
    } catch (error) {
      console.error('エクスポート中にエラーが発生:', error);
      dispatch('message', { text: 'エクスポートに失敗しました', type: 'error' });
    } finally {
      isImportExportLoading = false;
    }
  }

  async function importData(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }

    if (!window.confirm('既存のデータは上書かれます。本当にインポートしてよろしいですか？')) {
      input.value = '';
      return;
    }

    try {
      isImportExportLoading = true;
      const jsonString = await file.text();
      await importExportService.importData(jsonString);
      
      // データが更新されたので、最新のデータを取得して画面を更新
      const updatedData = await storageService.getAppData();
      dispatch('dataUpdated', { data: updatedData });
      dispatch('message', { text: 'フレームワークデータをインポートしました', type: 'success' });
    } catch (error) {
      console.error('インポート中にエラーが発生:', error);
      const errorMessage = error instanceof Error ? error.message : 'インポートに失敗しました';
      dispatch('message', { text: errorMessage, type: 'error' });
    } finally {
      isImportExportLoading = false;
      input.value = '';
    }
  }

  function openFileDialog(): void {
    const fileInput = document.getElementById('import-file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }
</script>

<div class="settings-container">
  <!-- APIキーセクション -->
  <div class="setting-api-key-section">
    <div class="form-group">
      <label for="apiKey">Gemini APIキー</label>
      <div class="input-button-group">
        <input 
          type="password" 
          id="apiKey"
          bind:value={$geminiApiKey}
          disabled={isLoading}
          data-testid="gemini-api-key-input"
          placeholder="APIキーを入力してください">
        <button
          id="saveApiKey"
          class="primary-button"
          on:click={saveApiKey}
          data-testid="save-gemini-api-key-button"
          data-provider-name="Gemini"
          disabled={isLoading}>{isLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="apiKey">OpenAI APIキー</label>
      <div class="input-button-group">
        <input 
          type="password" 
          id="apiKey"
          bind:value={$openaiApiKey}
          disabled={isLoading}
          data-testid="openai-api-key-input"
          placeholder="APIキーを入力してください">
        <button
          id="saveApiKey"
          class="primary-button"
          on:click={saveApiKey}
          data-testid="save-openai-api-key-button"
          data-provider-name="OpenAI"
          disabled={isLoading}>{isLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="apiKey">Anthropic APIキー</label>
      <div class="input-button-group">
        <input 
          type="password" 
          id="apiKey"
          bind:value={$anthropicApiKey}
          disabled={isLoading}
          data-testid="anthropic-api-key-input"
          placeholder="APIキーを入力してください">
        <button
          id="saveApiKey"
          class="primary-button"
          on:click={saveApiKey}
          data-testid="save-anthropic-api-key-button"
          data-provider-name="Anthropic"
          disabled={isLoading}>{isLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
  </div>

  <!-- インポート・エクスポートセクション -->
  <div class="import-export-section">
    <h3>データ管理</h3>
    <div class="import-export-group">
      <div class="import-export-item">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>フレームワーク・LLMプロンプトデータのエクスポート</label>
        <p class="description">作成したフレームワークとLLMプロンプトをJSONファイルとしてダウンロードします</p>
        <button
          class="secondary-button"
          on:click={exportData}
          disabled={isImportExportLoading}
          data-testid="export-button">
          {isImportExportLoading ? 'エクスポート中...' : 'エクスポート'}
        </button>
      </div>
      
      <div class="import-export-item">
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <label>フレームワーク・LLMプロンプトデータのインポート</label>
        <p class="description">JSONファイルからフレームワークとLLMプロンプトをインポートします（既存データは上書きされます）</p>
        <button
          class="secondary-button"
          on:click={openFileDialog}
          disabled={isImportExportLoading}
          data-testid="import-button">
          {isImportExportLoading ? 'インポート中...' : 'インポート'}
        </button>
        <input
          id="import-file-input"
          type="file"
          accept=".json"
          on:change={importData}
          style="display: none;"
          data-testid="import-file-input" />
      </div>
    </div>
  </div>

  <div class="feedback-link">
    <p>不具合の報告や機能のご要望は、ぜひこちらからお寄せください。</p>
    <a href="https://docs.google.com/forms/d/1GnBes2W30efxIYPVCICifyJRf6Mm1oFZf9zwV6tXcT8/viewform" target="_blank" rel="noopener noreferrer">フィードバックを送る</a>
  </div>
</div>

<style>
  .settings-container {
    padding: 0;
    display: flex;
    flex-direction: column;
  }

  .input-button-group {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .input-button-group input {
    flex: 1;
  }

  .input-button-group .primary-button {
    flex-shrink: 0;
  }

  .import-export-section {
    margin-top: 24px;
    padding-top: 20px;
    border-top: 1px solid #e0e0e0;
  }

  .import-export-section h3 {
    margin: 0 0 16px 0;
    font-size: 16px;
    font-weight: 600;
    color: #333;
  }

  .import-export-group {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .import-export-item {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .import-export-item label {
    font-weight: 500;
    font-size: 14px;
    color: #333;
  }

  .import-export-item .description {
    font-size: 12px;
    color: #666;
    margin: 0;
    line-height: 1.4;
  }

  .secondary-button {
    background-color: #f8f9fa;
    color: #333;
    border: 1px solid #dee2e6;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 14px;
    transition: background-color 0.2s;
    align-self: flex-start;
  }

  .secondary-button:hover:not(:disabled) {
    background-color: #e9ecef;
  }

  .secondary-button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .feedback-link {
    margin-top: 20px;
    text-align: center;
    font-size: 12px;
    color: #555;
  }

  .feedback-link p {
    margin-bottom: 8px;
  }

  .feedback-link a {
    color: #007bff;
    text-decoration: none;
  }

  .feedback-link a:hover {
    text-decoration: underline;
  }
</style> 