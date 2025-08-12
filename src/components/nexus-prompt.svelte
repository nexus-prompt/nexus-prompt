<script lang="ts">
  import type { AppData, MessageType, SnapshotData } from '../types';
  import { onMount, setContext } from 'svelte';
  import { STORAGE_KEY, SNAPSHOT_STORAGE_KEY } from '../services/storage';
  import Settings from './settings.svelte'; 
  import Frameworks from './frameworks.svelte';
  import Prompts from './prompts.svelte';
  import PromptImprovement from './prompt-improvement.svelte';
  import { writable, get } from 'svelte/store';
  import { appData, snapshotData, initializeStores } from '../stores';
  import '../chrome-mock'; // 開発環境用のChrome APIモック

  const viewContext = writable<'popup' | 'sidepanel' | 'unknown'>('unknown');
  const VIEW_CONTEXT = Symbol.for('viewContext');
  setContext(VIEW_CONTEXT, viewContext);

  // Local state
  let messageText: string = '';
  let messageType: MessageType = 'info';
  let showMessage: boolean = false;
  let messageTimeoutId: number | null = null;

  // chrome.storage の変更を監視し、UIを同期する
  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => {
    if (areaName !== 'local') return;

    if (changes[STORAGE_KEY]) {
      const newData = changes[STORAGE_KEY].newValue as AppData | null;
      if (newData && JSON.stringify(get(appData)) !== JSON.stringify(newData)) {
        appData.setFromStorage(newData);
        console.log('AppData has been updated from storage change.');
      }
    }

    if (changes[SNAPSHOT_STORAGE_KEY]) {
      const newSnapshot = changes[SNAPSHOT_STORAGE_KEY].newValue as SnapshotData | null;
      if (newSnapshot && JSON.stringify(get(snapshotData)) !== JSON.stringify(newSnapshot)) {
        snapshotData.setFromStorage(newSnapshot);
        console.log('Snapshot has been updated from storage change.');
      }
    }
  };

  onMount(() => {
    initializeStores().then(() => {
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
        console.warn('UIコンテキスト判定エラー。ポップアップとして扱います。', e);
        viewContext.set('popup');
      }
    });

    chrome.storage.onChanged.addListener(handleStorageChange);

    return () => {
      chrome.storage.onChanged.removeListener(handleStorageChange);
    };
  });

  async function switchTab(tabName: string): Promise<void> {
    snapshotData.update((current: SnapshotData | null) => {
      if (!current) return null;
      return { ...current, activeTab: tabName as 'main' | 'prompts' | 'frameworks' | 'settings' };
    });
  }

  async function resetPromptSelection(): Promise<void> {
    snapshotData.update((current: SnapshotData | null) => current ? { ...current, selectedPromptId: '' } : null);
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
    {#if $snapshotData}
      <button 
        class="tab-button {$snapshotData.activeTab === 'main' ? 'active' : ''}" 
        on:click={() => switchTab('main')}>
        メイン画面
      </button>
      <button 
        class="tab-button {$snapshotData.activeTab === 'prompts' ? 'active' : ''}" 
        on:click={() => switchTab('prompts')}>
        LLMプロンプト管理
      </button>
      <button 
      class="tab-button {$snapshotData.activeTab === 'frameworks' ? 'active' : ''}" 
        on:click={() => switchTab('frameworks')}>
        フレームワーク管理
      </button>
      <button 
        class="tab-button {$snapshotData.activeTab === 'settings' ? 'active' : ''}" 
        on:click={() => switchTab('settings')}>
        設定
      </button>
    {/if}
  </div>

  {#if $appData && $snapshotData && $viewContext}
    <!-- メイン画面（プロンプト改善） -->
    {#if $snapshotData.activeTab === 'main'}
    <div id="main" class="tab-content active">
      <PromptImprovement on:message={handleMessage} on:switchTab={handleSwitchTab} selectedPromptIdFromParent={$snapshotData?.selectedPromptId || ''} />
    </div>
    {/if}

    <!-- LLMプロンプト管理 -->
    {#if $snapshotData.activeTab === 'prompts'}
    <div id="prompts" class="tab-content active">
      <Prompts on:message={handleMessage} on:promptSelectionReset={handlePromptSelectionReset} />
    </div>
    {/if}

    <!-- フレームワーク管理 -->
    {#if $snapshotData.activeTab === 'frameworks'}
    <div id="frameworks" class="tab-content active">
      <Frameworks on:message={handleMessage} on:promptSelectionReset={handlePromptSelectionReset} />
    </div>
    {/if}

    <!-- 設定（APIキー） -->
    {#if $snapshotData.activeTab === 'settings'}
    <div id="settings" class="tab-content active">
      <Settings on:message={handleMessage} />
    </div>
    {/if}
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