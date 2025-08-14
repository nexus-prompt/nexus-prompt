<script lang="ts">
  import { storageService } from '../services/storage';
  import { FileImportExportService } from '../services/file-import-export';
  import { showToast } from '../stores';

  // Local state
  let geminiApiKey = $state('');
  let openaiApiKey = $state('');
  let anthropicApiKey = $state('');
  let isLoading = $state(false);
  let isImportExportLoading = $state(false);
  let initialized = $state(false);
  
  // Constants
  const MAX_API_KEY_LENGTH = 300;

  // Services
  const fileImportExportService = new FileImportExportService();

  $effect(() => {
    (async () => {
      if (initialized) return;
      try {
        geminiApiKey = (await storageService.getApiKey('Gemini')) || '';
        openaiApiKey = (await storageService.getApiKey('OpenAI')) || '';
        anthropicApiKey = (await storageService.getApiKey('Anthropic')) || '';
      } catch (error) {
        console.error('APIキーの読み込みに失敗:', error);
      } finally {
        initialized = true;
      }
    })();
  });

  function validateApiKey(key: string, maxLen: number): string | null {
    if (!key.trim()) return 'APIキーを入力してください';
    if (key.length > maxLen) return `APIキーは${maxLen}文字以内で入力してください`;
    return null;
  }

  type ProviderName = 'Gemini' | 'OpenAI' | 'Anthropic';
  async function saveApiKeyFor(providerName: ProviderName): Promise<void> {
    const apiKey = providerName === 'Gemini' ? geminiApiKey
      : providerName === 'OpenAI' ? openaiApiKey
      : anthropicApiKey;

    const error = validateApiKey(apiKey, MAX_API_KEY_LENGTH);
    if (error) {
      showToast(error, 'error');
      return;
    }

    try {
      isLoading = true;
      const success = await storageService.setApiKey(providerName, apiKey);
      showToast(success ? 'APIキーを保存しました' : 'APIキーの保存に失敗しました', success ? 'success' : 'error');
    } catch (error) {
      console.error('APIキーの保存中に予期せぬエラー:', error);
      showToast('APIキーの保存に失敗しました', 'error');
    } finally {
      isLoading = false;
    }
  }

  async function exportFile(): Promise<void> {
    try {
      isImportExportLoading = true;
      const zipBytes = await fileImportExportService.export();

      // ZIPダウンロードの実行（ArrayBufferに切り出して型互換にする）
      const arrayBuffer = zipBytes.buffer.slice(
        zipBytes.byteOffset,
        zipBytes.byteOffset + zipBytes.byteLength
      ) as ArrayBuffer;
      const blob = new Blob([arrayBuffer], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nexus-prompt-export-${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      showToast('データをZIPとしてエクスポートしました', 'success');
    } catch (error) {
      console.error('エクスポート中にエラーが発生:', error);
      showToast('エクスポートに失敗しました', 'error');
    } finally {
      isImportExportLoading = false;
    }
  }

  async function importFile(event: Event): Promise<void> {
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
      const arrayBuffer = await file.arrayBuffer();
      await fileImportExportService.import(arrayBuffer);
      
      showToast('フレームワークデータをインポートしました', 'success');
    } catch (error) {
      console.error('インポート中にエラーが発生:', error);
      const rawMessage = error instanceof Error ? error.message : 'インポートに失敗しました';
      const normalizedMessage = /central directory|zip file/i.test(rawMessage)
        ? 'インポートファイルの形式が正しくありません。'
        : rawMessage;
      showToast(normalizedMessage, 'error');
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
      <label for="geminiApiKey">Gemini APIキー</label>
      <div class="input-button-group">
        <input 
          type="password" 
          id="geminiApiKey"
          bind:value={geminiApiKey}
          disabled={isLoading}
          data-testid="gemini-api-key-input"
          placeholder="APIキーを入力してください">
        <button
          id="saveApiKey"
          class="primary-button"
          onclick={() => saveApiKeyFor('Gemini')}
          data-testid="save-gemini-api-key-button"
          disabled={isLoading}>{isLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="openaiApiKey">OpenAI APIキー</label>
      <div class="input-button-group">
        <input 
          type="password" 
          id="openaiApiKey"
          bind:value={openaiApiKey}
          disabled={isLoading}
          data-testid="openai-api-key-input"
          placeholder="APIキーを入力してください">
        <button
          id="saveApiKey"
          class="primary-button"
          onclick={() => saveApiKeyFor('OpenAI')}
          data-testid="save-openai-api-key-button"
          disabled={isLoading}>{isLoading ? '保存中...' : '保存'}
        </button>
      </div>
    </div>
    <div class="form-group">
      <label for="anthropicApiKey">Anthropic APIキー</label>
      <div class="input-button-group">
        <input 
          type="password" 
          id="anthropicApiKey"
          bind:value={anthropicApiKey}
          disabled={isLoading}
          data-testid="anthropic-api-key-input"
          placeholder="APIキーを入力してください">
        <button
          id="saveApiKey"
          class="primary-button"
          onclick={() => saveApiKeyFor('Anthropic')}
          data-testid="save-anthropic-api-key-button"
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
          onclick={exportFile}
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
          onclick={openFileDialog}
          disabled={isImportExportLoading}
          data-testid="import-button">
          {isImportExportLoading ? 'インポート中...' : 'インポート'}
        </button>
        <input
          id="import-file-input"
          type="file"
          accept=".zip"
          onchange={importFile}
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
  @reference "tailwindcss";
  .setting-api-key-section .form-group label {
    @apply mt-2;
  }
  .settings-container {
    @apply flex flex-col p-0;
  }
  .import-export-section { 
    @apply mt-6 pt-4 border-t border-gray-200;
  }
  .import-export-section h3 { 
    @apply mb-4 text-lg font-semibold text-gray-900;
  }
  .import-export-group {
    @apply flex flex-col gap-4; 
  }
  .import-export-item { 
    @apply flex flex-col gap-2;
  }
  .import-export-item label {
    @apply font-medium text-sm text-gray-900;
  }
  .import-export-item .description {
    @apply text-xs text-gray-600 m-0; 
  }

  .feedback-link {
    @apply mt-4 text-center text-xs text-gray-600;
  }
  .feedback-link p {
    @apply mb-2;
  }
  .feedback-link a {
    @apply text-blue-500 no-underline;
  }
  .feedback-link a:hover {
    @apply underline;
  }
</style> 