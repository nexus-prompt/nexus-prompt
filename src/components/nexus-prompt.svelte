<script lang="ts">
  import type { AppData, MessageType, SnapshotData } from '../types';
  import { onMount } from 'svelte';
  import { storageService, STORAGE_KEY, SNAPSHOT_STORAGE_KEY } from '../services/storage';
  import Settings from './settings.svelte'; 
  import Frameworks from './frameworks.svelte';
  import Prompts from './prompts.svelte';
  import PromptImprovement from './prompt-improvement.svelte';
  import { writable } from 'svelte/store';
  import '../chrome-mock'; // 開発環境用のChrome APIモック

  // UIコンテキスト（popupかsidepanelか）を保持するストア
  const viewContext = writable<'popup' | 'sidepanel' | 'unknown'>('unknown');
  // 親 onMount の初期化が完了したかどうか
  let parentReady = false;

  // Local state
  const currentData = writable<AppData>({
    providers: [],
    frameworks: [],
    prompts: [],
    settings: {
      defaultFrameworkId: '',
      version: '1.1.0'
    },
  });
  const currentSnapshot = writable<SnapshotData>({
    userPrompt: '',
    selectedPromptId: '',
    resultArea: '',
    selectedModelId: '',
    activeTab: 'main',
    editingTarget: { type: null, id: '' }
  });
  const selectedPromptId = writable('');
  
  let messageText: string = '';
  let messageType: MessageType = 'info';
  let showMessage: boolean = false;
  let messageTimeoutId: number | null = null;

  // chrome.storage の変更を監視し、UIを同期する
  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'local') return;

    // AppDataが変更された場合、ローカルの状態を更新
    if (changes[STORAGE_KEY]) {
      const newData = changes[STORAGE_KEY].newValue as AppData;
      if (newData) {
        currentData.set(newData);
        console.log('AppData has been updated from storage change.');
      }
    }

    if (changes[SNAPSHOT_STORAGE_KEY]) {
      const newSnapshot = changes[SNAPSHOT_STORAGE_KEY].newValue as SnapshotData;
      if (newSnapshot) {
        currentSnapshot.set(newSnapshot);
        console.log('Snapshot has been updated from storage change.');
      }
    }

    // 必要に応じて他のキー（例: SNAPSHOT_STORAGE_KEY）の変更もここでハンドルできる
  };

  onMount(() => {
    const initialize = async () => {
      // AppData の初期取得（なければ初期化してから再取得）
      try {
        currentData.set(await storageService.getAppData());
      } catch (e) {
        console.warn('AppDataが未初期化のため初期化します:', e);
        await storageService.initializeAppData();
        currentData.set(await storageService.getAppData());
      }

      // Snapshot は常にデフォルトで初期化されるよう getSnapshot 側で保証
      currentSnapshot.set(await storageService.getSnapshot());
      selectedPromptId.set($currentSnapshot.selectedPromptId);
      
      try {
        const isPopupView = (() => {
          try {
            const views = (chrome.extension as any)?.getViews?.({ type: 'popup' }) ?? [];
            return Array.isArray(views) && views.includes(window as any);
          } catch {
            return false;
          }
        })();

        if (isPopupView) {
          viewContext.set('popup');
        } else {
          viewContext.set('sidepanel');
        }
      } catch (e) {
        // 判定失敗時は保守的にポップアップ扱い
        console.warn('UIコンテキスト判定エラー。ポップアップとして扱います。', e);
        viewContext.set('popup');
      }
    };
    (async () => {
      await initialize();
      parentReady = true;
    })();

    // リスナーを登録
    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  });

  async function switchTab(tabName: string): Promise<void> {
    const newSnapshot = structuredClone($currentSnapshot);
    newSnapshot.activeTab = tabName as 'main' | 'prompts' | 'frameworks' | 'settings';
    currentSnapshot.set(newSnapshot);
    storageService.saveSnapshot(newSnapshot);
  }

  async function resetPromptSelection(): Promise<void> {
    const newSnapshot = structuredClone($currentSnapshot);
    newSnapshot.selectedPromptId = '';
    currentSnapshot.set(newSnapshot);
    storageService.saveSnapshot(newSnapshot);
    selectedPromptId.set('');
  }

  function displayMessage(text: string, type: MessageType = 'info'): void {
    if (messageTimeoutId !== null) {
      clearTimeout(messageTimeoutId);
      messageTimeoutId = null;
    }

    messageText = text;
    messageType = type;
    showMessage = true;

    messageTimeoutId = window.setTimeout(() => {
      showMessage = false;
      messageTimeoutId = null;
    }, 3000);
  }

  function handleMessage(event: CustomEvent<{ text: string; type: MessageType }>): void {
    displayMessage(event.detail.text, event.detail.type);
    // APIキー未設定メッセージが来た場合は、確実に「設定」タブへ切り替える
    if (event.detail.text.includes('APIキーを設定してください')) {
      switchTab('settings');
    }
  }

  function handleDataUpdated(event: CustomEvent<{ data: AppData }>): void {
    currentData.set(event.detail.data);
  }

  function handleSnapshotUpdated(event: CustomEvent<{ snapshot: SnapshotData }>): void {
    currentSnapshot.set(event.detail.snapshot);
  }

  async function handlePromptSelectionReset(): Promise<void> {
    await resetPromptSelection();
  }

  function handleSwitchTab(event: CustomEvent<{ tabName: string }>): void {
    switchTab(event.detail.tabName);
  }
</script>

<div class="container" id="nexus-prompt" data-testid="nexus-prompt">
  <!-- タブナビゲーション -->
  <div class="tabs">
    <button 
      class="tab-button {$currentSnapshot.activeTab === 'main' ? 'active' : ''}" 
      on:click={() => switchTab('main')}>
      メイン画面
    </button>
    <button 
      class="tab-button {$currentSnapshot.activeTab === 'prompts' ? 'active' : ''}" 
      on:click={() => switchTab('prompts')}>
      LLMプロンプト管理
    </button>
    <button 
    class="tab-button {$currentSnapshot.activeTab === 'frameworks' ? 'active' : ''}" 
      on:click={() => switchTab('frameworks')}>
      フレームワーク管理
    </button>
    <button 
      class="tab-button {$currentSnapshot.activeTab === 'settings' ? 'active' : ''}" 
      on:click={() => switchTab('settings')}>
      設定
    </button>
  </div>

  <!-- メイン画面（プロンプト改善） -->
  {#if $currentSnapshot.activeTab === 'main' && parentReady}
  <div id="main" class="tab-content active">
    <PromptImprovement 
      currentData={$currentData}
      currentSnapshot={$currentSnapshot}
      selectedPromptIdFromParent={$selectedPromptId}
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
      on:snapshotUpdated={handleSnapshotUpdated}
      on:switchTab={handleSwitchTab}
    />
  </div>
  {/if}

  <!-- LLMプロンプト管理 -->
  {#if $currentSnapshot.activeTab === 'prompts' && parentReady}
  <div id="prompts" class="tab-content active">
    <Prompts
      currentData={$currentData}
      currentSnapshot={$currentSnapshot}
      viewContext={$viewContext}
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
      on:snapshotUpdated={handleSnapshotUpdated}
      on:promptSelectionReset={handlePromptSelectionReset}
    />
  </div>
  {/if}

  <!-- フレームワーク管理 -->
  {#if $currentSnapshot.activeTab === 'frameworks'}
  <div id="frameworks" class="tab-content active">
    <Frameworks
      currentData={$currentData}
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
      on:promptSelectionReset={handlePromptSelectionReset}
    />
  </div>
  {/if}

  <!-- 設定（APIキー） -->
  {#if $currentSnapshot.activeTab === 'settings'}
  <div id="settings" class="tab-content active">
    <Settings 
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
    />
  </div>
  {/if}
</div>

<!-- メッセージ表示エリア -->
{#if showMessage}
<div id="messageArea" class="message-area {messageType}" data-testid="message-area" style="display: block;">
  {messageText}
</div>
{/if}

<style>
  /* Svelteコンポーネント用のスタイル */
  @import '../../styles.css';
</style> 