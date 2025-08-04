<script lang="ts">
  import type { AppData, MessageType } from '../types';
  import { onMount } from 'svelte';
  import { storageService } from '../services/storage';
  import Settings from './settings.svelte';
  import Frameworks from './frameworks.svelte';
  import Prompts from './prompts.svelte';
  import PromptImprovement from './prompt-improvement.svelte';
  import { writable } from 'svelte/store';
  import '../chrome-mock'; // 開発環境用のChrome APIモック

  // Local state
  const currentData = writable<AppData>({
    providers: [],
    frameworks: [],
    settings: {
      defaultFrameworkId: '',
      version: '1.0.8'
    },
  });
  const selectedPromptId = writable('');
  const activeTab = writable('main');
  
  let messageText: string = '';
  let messageType: MessageType = 'info';
  let showMessage: boolean = false;
  let messageTimeoutId: number | null = null;

  onMount(async () => {
    currentData.set(await storageService.getAppData());
  });

  async function switchTab(tabName: string): Promise<void> {
    activeTab.set(tabName);
  }

  async function resetPromptSelection(): Promise<void> {
    const draft = await storageService.getDraft();
    if (draft) {
      draft.selectedPromptId = '';
      await storageService.saveDraft(draft);
    }
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
  }

  function handleDataUpdated(event: CustomEvent<{ data: AppData }>): void {
    currentData.set(event.detail.data);
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
      class="tab-button {$activeTab === 'main' ? 'active' : ''}" 
      on:click={() => switchTab('main')}>
      メイン画面
    </button>
    <button 
      class="tab-button {$activeTab === 'framework' ? 'active' : ''}" 
      on:click={() => switchTab('framework')}>
      フレームワーク管理
    </button>
    <button 
      class="tab-button {$activeTab === 'prompts' ? 'active' : ''}" 
      on:click={() => switchTab('prompts')}>
      LLMプロンプト管理
    </button>
    <button 
      class="tab-button {$activeTab === 'settings' ? 'active' : ''}" 
      on:click={() => switchTab('settings')}>
      設定
    </button>
  </div>

  <!-- メイン画面（プロンプト改善） -->
  {#if $activeTab === 'main'}
  <div id="main" class="tab-content active">
    <PromptImprovement 
      currentData={$currentData}
      selectedPromptIdFromParent={$selectedPromptId}
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
      on:switchTab={handleSwitchTab}
    />
  </div>
  {/if}

  <!-- フレームワーク管理 -->
  {#if $activeTab === 'framework'}
  <div id="framework" class="tab-content active">
    <Frameworks
      currentData={$currentData}
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
      on:promptSelectionReset={handlePromptSelectionReset}
    />
  </div>
  {/if}

  <!-- LLMプロンプト管理 -->
  {#if $activeTab === 'prompts'}
  <div id="prompts" class="tab-content active">
    <Prompts
      currentData={$currentData}
      on:message={handleMessage}
      on:dataUpdated={handleDataUpdated}
      on:promptSelectionReset={handlePromptSelectionReset}
    />
  </div>
  {/if}

  <!-- 設定（APIキー） -->
  {#if $activeTab === 'settings'}
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