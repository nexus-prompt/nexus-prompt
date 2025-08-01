import type { AppData, Framework, Prompt, Provider, DraftData } from '../types';
import { SecureApiKeyManager } from '../secure-api-key-manager';
import { providersData } from '../data/llm-providers';
import { Provider as ProviderData, Model as ModelData } from '../data/types';  

// ストレージキー
export const STORAGE_KEY = 'nexus/appData';
export const DRAFT_STORAGE_KEY = 'nexus/draft';

/**
 * データストレージ管理クラス
 */
export class StorageService {
  private apiKeyManager: SecureApiKeyManager;

  constructor() {
    this.apiKeyManager = new SecureApiKeyManager();
  }

  /**
   * アプリケーションデータを取得
   */
  async getAppData(): Promise<AppData> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    if (result[STORAGE_KEY]) {
      const data = result[STORAGE_KEY] as AppData;
      return data;
    } else {
      // onInstalledで初期化されるため、通常このパスは通りません。
      // 通った場合は予期せぬ状態なのでエラーをスローします。
      throw new Error('アプリケーションデータが見つかりません。拡張機能の再読み込みや再インストールをお試しください。');
    }
  }

  /**
   * アプリケーションデータを初期化
   * 拡張機能のインストール時またはアップデート時に呼び出されることを想定しています。
   */
  async initializeAppData(): Promise<void> {
    const result = await chrome.storage.local.get([STORAGE_KEY]);
    const existingData = result[STORAGE_KEY] as AppData | undefined;

    if (existingData) {
      // データが既にある場合（アップデートなど）：データのマイグレーション処理
      const { providers: mergedProviders, hasChanged } = await this.mergeProviders(existingData.providers);
      if (hasChanged) {
        existingData.providers = mergedProviders;
        await this.saveAppData(existingData);
      }
    } else {
      // データが存在しない場合（初回インストール）：初期データを作成
      const providers = await this.loadProviders();
      const frameworkId = crypto.randomUUID();
      const defaultData: AppData = {
        providers,
        frameworks: [{
          id: frameworkId,
          name: 'デフォルトフレームワーク',
          content: '',
          prompts: [],
          order: 1,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }],
        settings: {
          defaultFrameworkId: frameworkId,
          version: '1.0.7' // TODO: manifest.jsonから動的に取得する
        }
      };
      await this.saveAppData(defaultData);
    }
  }

  /**
   * プロバイダー情報をデータから読み込む
   */
  private async loadProviders(): Promise<Provider[]> {
    return providersData.providers.map((provider: ProviderData) => ({
      id: crypto.randomUUID(),
      name: provider.name,
      displayName: provider.displayName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      models: provider.models.map((model: ModelData, index: number) => ({
        id: crypto.randomUUID(),
        name: model.name,
        order: index + 1,
        enabled: true,
        isBuiltIn: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }))
    }));
  }
 
  /**
   * ユーザーのプロバイダー情報とマスターデータをマージする
   * @param userProviders ユーザーが現在保存しているプロバイダー情報
   * @returns マージ後のプロバイダー情報と、変更があったかどうかのフラグ
   */
  private async mergeProviders(userProviders: Provider[]): Promise<{ providers: Provider[], hasChanged: boolean }> {
    const sourceProvidersData = providersData.providers;
    let hasChanged = false;

    const userProvidersMap = new Map<string, Provider>(userProviders.map(p => [p.name, p]));

    for (const sourceProvider of sourceProvidersData) {
      const existingProvider = userProvidersMap.get(sourceProvider.name);

      if (!existingProvider) {
        // 新しいプロバイダーを追加
        userProviders.push({
          id: crypto.randomUUID(),
          name: sourceProvider.name,
          displayName: sourceProvider.displayName,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          models: sourceProvider.models.map((model: ModelData, index: number) => ({
            id: crypto.randomUUID(),
            name: model.name,
            order: index + 1,
            enabled: true,
            isBuiltIn: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          })),
        });
        hasChanged = true;
      } else {
        // 既存プロバイダーに新しいモデルがないかチェック
        const existingModelsMap = new Map<string, ModelData>(existingProvider.models.map(m => [m.name, m]));
        for (const sourceModel of sourceProvider.models) {
          if (!existingModelsMap.has(sourceModel.name)) {
            existingProvider.models.push({
              id: crypto.randomUUID(),
              name: sourceModel.name,
              order: existingProvider.models.length + 1,
              enabled: true,
              isBuiltIn: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
            hasChanged = true;
          }
        }
      }
    }

    return { providers: userProviders, hasChanged };
  }

  /**
   * アプリケーションデータを保存
   */
  async saveAppData(data: AppData): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: data });
  }

  /**
   * APIキーを取得（復号化）
   */
  async getApiKey(provider: string): Promise<string | null> {
    return await this.apiKeyManager.getApiKey(provider);
  }

  /**
   * APIキーを設定（暗号化）
   */
  async setApiKey(provider: string, apiKey: string): Promise<boolean> {
    return await this.apiKeyManager.saveApiKey(provider, apiKey);
  }

  /**
   * デフォルトフレームワークを取得
   */
  async getDefaultFramework(): Promise<Framework | null> {
    const data = await this.getAppData();
    const defaultFramework = data.frameworks.find(f => f.id === data.settings.defaultFrameworkId);
    return defaultFramework || data.frameworks[0] || null;
  }

  /**
   * フレームワークを保存
   */
  async saveFramework(framework: Framework): Promise<void> {
    const data = await this.getAppData();
    const index = data.frameworks.findIndex(f => f.id === framework.id);
    
    if (index !== -1) {
      data.frameworks[index] = framework;
    } else {
      data.frameworks.push(framework);
    }
    
    await this.saveAppData(data);
  }

  /**
   * プロンプトを取得
   */
  async getPrompts(): Promise<Prompt[]> {
    const framework = await this.getDefaultFramework();
    return framework?.prompts || [];
  }

  /**
   * プロンプトを保存
   */
  async savePrompt(prompt: Prompt): Promise<void> {
    const framework = await this.getDefaultFramework();
    if (!framework) return;
    
    const index = framework.prompts.findIndex(p => p.id === prompt.id);
    
    if (index !== -1) {
      framework.prompts[index] = prompt;
    } else {
      framework.prompts.push(prompt);
    }
    
    framework.updatedAt = new Date().toISOString();
    await this.saveFramework(framework);
  }

  /**
   * プロンプトを削除
   */
  async deletePrompt(promptId: string): Promise<void> {
    const framework = await this.getDefaultFramework();
    if (!framework) return;
    
    framework.prompts = framework.prompts.filter(p => p.id !== promptId);
    framework.updatedAt = new Date().toISOString();
    await this.saveFramework(framework);
  }

  /**
  * ドラフトデータを保存
  */
  async saveDraft(data: DraftData): Promise<void> {
    await chrome.storage.local.set({ [DRAFT_STORAGE_KEY]: data });
  }

  /**
   * ドラフトデータを取得
   */
  async getDraft(): Promise<DraftData> {
    const result = await chrome.storage.local.get([DRAFT_STORAGE_KEY]);
    return result[DRAFT_STORAGE_KEY] as DraftData;
  }
}

// シングルトンインスタンスをエクスポート
export const storageService = new StorageService();
