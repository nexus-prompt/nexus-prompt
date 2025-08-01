import { describe, it, expect, beforeEach, vi,  } from 'vitest';
import type { AppData, Framework, Prompt, Provider, DraftData } from '../../types';
import { StorageService, STORAGE_KEY, DRAFT_STORAGE_KEY } from '../../services/storage';

// Chrome storage APIのモック
const mockChromeStorage = {
  local: {
    get: vi.fn(),
    set: vi.fn(),
  },
};

// SecureApiKeyManagerのモック関数を作成
const mockGetApiKey = vi.hoisted(() => vi.fn());
const mockSaveApiKey = vi.hoisted(() => vi.fn());

const masterProvidersData = {
  providers: [
    {
      name: 'Gemini',
      displayName: 'Google Gemini',
      models: [{ name: 'gemini-2.0-flash' }, { name: 'gemini-1.5-pro' }],
    },
    { name: 'Claude', displayName: 'Anthropic Claude', models: [{ name: 'claude-3-opus' }] },
  ],
};

vi.mock('../../data/llm-providers', () => ({
  providersData: {
    providers: [
      {
        name: 'Gemini',
        displayName: 'Google Gemini',
        models: [{ name: 'gemini-2.0-flash' }]
      },
    ]
  }
}));

// モジュールのモック
vi.mock('../../secure-api-key-manager', () => ({
  SecureApiKeyManager: vi.fn().mockImplementation(() => ({
    getApiKey: mockGetApiKey,
    saveApiKey: mockSaveApiKey,
  })),
}));

// --- テストデータファクトリ ---
const createMockPrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: 'prompt1',
  name: 'テストプロンプト',
  content: 'テスト内容',
  order: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockFramework = (overrides: Partial<Framework> = {}): Framework => ({
  id: 'framework1',
  name: 'テストフレームワーク',
  content: 'テスト内容',
  prompts: [],
  order: 1,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockProvider = (overrides: Partial<Provider> = {}): Provider => ({
  id: 'provider1',
  name: 'Gemini',
  displayName: 'Google Gemini',
  models: [{ id: 'model1', name: 'gemini-2.0-flash', order: 1, enabled: true, isBuiltIn: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

const createMockAppData = (overrides: Partial<AppData> = {}): AppData => ({
  providers: [createMockProvider()],
  frameworks: [createMockFramework()],
  settings: { defaultFrameworkId: 'framework1', version: '1.0.0' },
  ...overrides,
});

const createMockDraftData = (overrides: Partial<DraftData> = {}): DraftData => ({
  userPrompt: 'ユーザープロンプト',
  selectedPromptId: 'prompt1',
  resultArea: 'テスト結果',
  selectedModelId: 'model1',
  ...overrides,
});

describe('StorageService', () => {
  let storageService: StorageService;

  beforeEach(async () => {
    // グローバルオブジェクトのモック設定
    (globalThis as any).chrome = {
      storage: mockChromeStorage
    };

    // モックのリセット
    vi.clearAllMocks();

    // 各テストが他のテストに影響を与えないように、デフォルトの成功するモック実装をここで設定。
    mockChromeStorage.local.get.mockResolvedValue({});
    mockChromeStorage.local.set.mockResolvedValue(undefined);

    storageService = new StorageService(); // インスタンスを再生成
  });

  describe('getAppData', () => {
    it('既存のデータを取得する', async () => {
      const existingData = createMockAppData();

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: existingData
      });

      const result = await storageService.getAppData();

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith([STORAGE_KEY]);
      expect(result).toEqual(existingData);
    });

    it('データが存在しない場合、エラーをスローする', async () => {
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: undefined
      });

      await expect(
        storageService.getAppData()
      ).rejects.toThrow('アプリケーションデータが見つかりません。拡張機能の再読み込みや再インストールをお試しください。');
      expect(mockChromeStorage.local.get).toHaveBeenCalledWith([STORAGE_KEY]);
    });
  });

  describe('initializeAppData', () => {
    it('データを初期化する', async () => {
      const result = await storageService.initializeAppData();
      expect(result).toBeUndefined();
    });

    it('データが存在しない場合、デフォルトデータを作成する', async () => {
      let savedData: AppData | null = null;

      mockChromeStorage.local.set.mockImplementation(async (items) => {
        if (items[STORAGE_KEY]) {
          savedData = items[STORAGE_KEY];
        }
      });

      mockChromeStorage.local.get
        .mockResolvedValueOnce({})
        .mockImplementation(async () => {
          return savedData ? { [STORAGE_KEY]: savedData } : {};
        });

      await storageService.initializeAppData();
      const result = await storageService.getAppData();

      expect(mockChromeStorage.local.set).toHaveBeenCalledTimes(1);
      expect(mockChromeStorage.local.get).toHaveBeenCalledTimes(2);
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('Gemini');
      expect(result.frameworks).toHaveLength(1);
      expect(result.frameworks[0].name).toBe('デフォルトフレームワーク');
      expect(result).toEqual(savedData);
    });

    it('既存のプロバイダーデータが存在する場合、マスターデータとマージする', async () => {
      // 既存のプロバイダーデータ（gemini-2.0-flashモデルのみ）
      const existingProvider = createMockProvider({
        models: [{ id: 'model1', name: 'gemini-2.0-flash', order: 1, enabled: true, isBuiltIn: true, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }]
      });
      const existingData = createMockAppData({ providers: [existingProvider] });

      // マスターデータに新しいモデルが追加されたことをシミュレート
      vi.doMock('../../data/llm-providers', () => ({
        providersData: {
          providers: [
            {
              name: 'Gemini',
              models: [
                { name: 'gemini-2.0-flash' },
                { name: 'gemini-1.5-pro' } // 新しいモデル
              ]
            }
          ]
        }
      }));

      // モジュールを再読み込み
      vi.resetModules();
      const { StorageService: ServiceWithNewModel } = await import('../../services/storage');
      const serviceWithNewModel = new ServiceWithNewModel();

      let savedData: AppData | null = null;

      mockChromeStorage.local.set.mockImplementation(async (items) => {
        if (items[STORAGE_KEY]) {
          savedData = items[STORAGE_KEY];
        }
      });

      mockChromeStorage.local.get
        .mockResolvedValueOnce({[STORAGE_KEY]: existingData})
        .mockImplementation(async () => {
          return savedData ? { [STORAGE_KEY]: savedData } : {};
        });

      await serviceWithNewModel.initializeAppData();

      // データが保存されることを確認（マージによって変更があったため）
      expect(mockChromeStorage.local.set).toHaveBeenCalled();
      
      const result = await serviceWithNewModel.getAppData();

      // プロバイダーの数は変わらない
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('Gemini');
      
      // モデルが2つになっている（既存 + 新規）
      expect(result.providers[0].models).toHaveLength(2);
      expect(result.providers[0].models.some(m => m.name === 'gemini-2.0-flash')).toBe(true);
      expect(result.providers[0].models.some(m => m.name === 'gemini-1.5-pro')).toBe(true);
    });

    it('プロバイダー配列が空の場合、データを読み込む', async () => {
      const existingData = createMockAppData({ providers: [] });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: existingData
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.initializeAppData();
      const result = await storageService.getAppData();

      expect(mockChromeStorage.local.set).toHaveBeenCalled();
      expect(result.providers).toHaveLength(1);
      expect(result.providers[0].name).toBe('Gemini');
    });
  });

  describe('saveAppData', () => {
    it('データを保存する', async () => {
      const testData = createMockAppData();

      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.saveAppData(testData);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: testData
      });
    });
  });

  describe('getApiKey', () => {
    it('GeminiのAPIキーを取得する', async () => {
      const expectedKey = 'test-api-key';
      mockGetApiKey.mockResolvedValue(expectedKey);

      const result = await storageService.getApiKey('Gemini');

      expect(mockGetApiKey).toHaveBeenCalled();
      expect(result).toBe(expectedKey);
    });

    it('Gemini以外のプロバイダーの場合でもAPIキーを返す', async () => {
      const expectedKey = 'test-api-key';
      mockGetApiKey.mockResolvedValue(expectedKey);

      const result = await storageService.getApiKey('Claude');

      expect(mockGetApiKey).toHaveBeenCalled();
      expect(result).toBe(expectedKey);
    });

    it('apiKeyManagerがエラーをスローした場合、エラーが伝播する', async () => {
      const apiError = new Error('APIキー取得失敗');
      mockGetApiKey.mockRejectedValue(apiError);

      await expect(storageService.getApiKey('Gemini')).rejects.toThrow(
        apiError
      );
    });
  });

  describe('setApiKey', () => {
    it('GeminiのAPIキーを設定する', async () => {
      const providerName = 'Gemini';
      const apiKey = 'test-api-key';
      mockSaveApiKey.mockResolvedValue(true);

      const result = await storageService.setApiKey(providerName, apiKey);

      expect(mockSaveApiKey).toHaveBeenCalledWith(providerName, apiKey);
      expect(result).toBe(true);
    });

    it('Gemini以外のプロバイダーの場合でもAPIキーを設定する', async () => {
      const providerName = 'Claude';
      const apiKey = 'test-api-key';
      mockSaveApiKey.mockResolvedValue(true);

      const result = await storageService.setApiKey(providerName, apiKey);

      expect(mockSaveApiKey).toHaveBeenCalledWith(providerName, apiKey);
      expect(result).toBe(true);
    });

    it('apiKeyManagerがfalseを返した場合、falseを返す', async () => {
      mockSaveApiKey.mockResolvedValue(false);
      const result = await storageService.setApiKey('Gemini', 'any-key');
      expect(result).toBe(false);
    });
  });

  describe('getDefaultFramework', () => {
    it('settings.defaultFrameworkIdに基づいてデフォルトフレームワークを取得する', async () => {
      const framework1 = createMockFramework({ id: 'fw1', name: 'フレームワーク1' });
      const framework2 = createMockFramework({ id: 'fw2', name: 'フレームワーク2' });
      const testData = createMockAppData({
        frameworks: [framework1, framework2],
        settings: { defaultFrameworkId: 'fw2', version: '1.0.0' },
      });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });

      const result = await storageService.getDefaultFramework();

      expect(result).toEqual(framework2);
    });

    it('フレームワークが存在しない場合nullを返す', async () => {
      const testData = createMockAppData({ frameworks: [] });

      mockChromeStorage.local.get.mockResolvedValue({ [STORAGE_KEY]: testData });

      const result = await storageService.getDefaultFramework();

      expect(result).toBeNull();
    });

    it('defaultFrameworkIdが無効な場合、最初のフレームワークにフォールバックする', async () => {
      const framework1 = createMockFramework({ id: 'fw1', name: 'フレームワーク1' });
      const framework2 = createMockFramework({ id: 'fw2', name: 'フレームワーク2' });
      const testData = createMockAppData({
        frameworks: [framework1, framework2],
        settings: { defaultFrameworkId: 'non-existent-id', version: '1.0.0' },
      });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });

      const result = await storageService.getDefaultFramework();
      expect(result).toEqual(framework1); // Should fall back to the first element
    });
  });

  describe('saveFramework', () => {
    it('既存のフレームワークを更新する', async () => {
      const existingFramework = createMockFramework();
      const testData = createMockAppData({ frameworks: [existingFramework] });

      const updatedFramework: Framework = {
        ...existingFramework,
        content: '更新された内容'
      };

      mockChromeStorage.local.get.mockResolvedValue({ [STORAGE_KEY]: testData });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.saveFramework(updatedFramework);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: {
          ...testData,
          frameworks: [updatedFramework]
        }
      });
    });

    it('新しいフレームワークを追加する', async () => {
      const existingFramework = createMockFramework({ id: 'fw1' });
      const testData = createMockAppData({
        frameworks: [existingFramework],
        settings: { defaultFrameworkId: 'fw1', version: '1.0.0' },
      });
      const newFramework = createMockFramework({ id: 'fw2' });
      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.saveFramework(newFramework);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: {
          ...testData,
          frameworks: [existingFramework, newFramework]
        }
      });
    });
  });

  describe('getPrompts', () => {
    it('プロンプトを取得する', async () => {
      const testPrompts = [createMockPrompt()];
      const testFramework = createMockFramework({ prompts: testPrompts });
      const testData = createMockAppData({
        frameworks: [testFramework],
        settings: { defaultFrameworkId: testFramework.id, version: '1.0.0' },
      });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });

      const result = await storageService.getPrompts();

      expect(result).toEqual(testPrompts);
    });

    it('フレームワークが存在しない場合空配列を返す', async () => {
      const testData = createMockAppData({ frameworks: [] });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });

      const result = await storageService.getPrompts();

      expect(result).toEqual([]);
    });
  });

  describe('savePrompt', () => {
    it('既存のプロンプトを更新する', async () => {
      const existingPrompt = createMockPrompt({ id: 'p1' });
      const testFramework = createMockFramework({ prompts: [existingPrompt] });
      const testData = createMockAppData({
        frameworks: [testFramework],
        settings: { defaultFrameworkId: testFramework.id, version: '1.0.0' },
      });

      const updatedPrompt: Prompt = {
        ...existingPrompt,
        content: '更新された内容'
      };

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.savePrompt(updatedPrompt);

      // フレームワークのupdatedAtが更新されることを確認
      const expectedFramework = {
        ...testFramework,
        prompts: [updatedPrompt],
        updatedAt: expect.any(String)
      };

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: {
          ...testData,
          frameworks: [expectedFramework]
        }
      });
    });

    it('新しいプロンプトを追加する', async () => {
      const existingPrompt = createMockPrompt({ id: 'p1' });
      const testFramework = createMockFramework({ prompts: [existingPrompt] });
      const testData = createMockAppData({
        frameworks: [testFramework],
        settings: { defaultFrameworkId: testFramework.id, version: '1.0.0' },
      });
      const newPrompt = createMockPrompt({ id: 'p2' });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.savePrompt(newPrompt);

      const expectedFramework = {
        ...testFramework,
        prompts: [existingPrompt, newPrompt],
        updatedAt: expect.any(String)
      };

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: {
          ...testData,
          frameworks: [expectedFramework]
        }
      });
    });

    it('デフォルトフレームワークが存在しない場合、何もせずに終了する', async () => {
      const testData = createMockAppData({ frameworks: [] });
      mockChromeStorage.local.get.mockResolvedValue({ [STORAGE_KEY]: testData });

      await storageService.savePrompt(createMockPrompt());

      expect(mockChromeStorage.local.set).not.toHaveBeenCalled();
    });
  });

  describe('deletePrompt', () => {
    it('プロンプトを削除する', async () => {
      const prompt1 = createMockPrompt({ id: 'p1' });
      const prompt2 = createMockPrompt({ id: 'p2' });
      const testFramework = createMockFramework({ prompts: [prompt1, prompt2] });
      const testData = createMockAppData({
        frameworks: [testFramework],
        settings: { defaultFrameworkId: testFramework.id, version: '1.0.0' },
      });

      mockChromeStorage.local.get.mockResolvedValue({
        [STORAGE_KEY]: testData
      });
      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.deletePrompt('p1');

      const expectedFramework = {
        ...testFramework,
        prompts: [prompt2],
        updatedAt: expect.any(String)
      };

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [STORAGE_KEY]: {
          ...testData,
          frameworks: [expectedFramework]
        }
      });
    });

    it('存在しないpromptIdを渡した場合、データは変更されない', async () => {
      const prompt1 = createMockPrompt({ id: 'p1' });
      const testFramework = createMockFramework({ prompts: [prompt1] });
      const testData = createMockAppData({ frameworks: [testFramework] });

      mockChromeStorage.local.get.mockResolvedValue({ [STORAGE_KEY]: testData });

      await storageService.deletePrompt('non-existent-id');

      // setが呼ばれるが、中身は変わらないことを確認
      const calledWith = mockChromeStorage.local.set.mock.calls[0][0];
      expect(calledWith[STORAGE_KEY].frameworks[0].prompts).toHaveLength(1);
      expect(calledWith[STORAGE_KEY].frameworks[0].prompts[0].id).toBe('p1');
    });

    it('デフォルトフレームワークが存在しない場合、何もせずに終了する', async () => {
      const testData = createMockAppData({ frameworks: [] });
      mockChromeStorage.local.get.mockResolvedValue({ [STORAGE_KEY]: testData });

      await storageService.deletePrompt('any-id');
      expect(mockChromeStorage.local.set).not.toHaveBeenCalled();
    });
  });

  // プライベートメソッド mergeProviders の直接テスト
  describe('mergeProviders', () => {
    let service: StorageService;

    beforeEach(async () => {
      // モックを適用する前にモジュールキャッシュをリセットすることが重要
      vi.resetModules();
      vi.doMock('../../data/llm-providers', () => ({
        providersData: masterProvidersData,
      }));
      const { StorageService: ServiceForMerge } = await import(
        '../../services/storage'
      );
      service = new ServiceForMerge();
    });

    it('新しいプロバイダーをマスターデータから追加するべき', async () => {
      // ユーザーはGeminiしか持っていない
      const userProviders = [createMockProvider({ name: 'Gemini' })];

      const { providers, hasChanged } = await (service as any).mergeProviders(
        userProviders
      );

      expect(hasChanged).toBe(true);
      expect(providers).toHaveLength(2);
      expect(providers.some((p: { name: string; }) => p.name === 'Claude')).toBe(true);
    });

    it('既存プロバイダーに新しいモデルをマスターデータから追加するべき', async () => {
      // ユーザーは古いモデル情報しか持っていない
      const userProviders = [
        createMockProvider({
          name: 'Gemini',
          models: [{ id: 'm1', name: 'gemini-2.0-flash', order: 1, enabled: true, isBuiltIn: true, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }],
        }),
      ];

      const { providers, hasChanged } = await (service as any).mergeProviders(
        userProviders
      );

      expect(hasChanged).toBe(true);
      expect(providers[0].models).toHaveLength(2);
      expect(providers[0].models.some((m: { name: string; }) => m.name === 'gemini-1.5-pro')).toBe(true);
    });

    it('ユーザーデータとマスターデータが同じ場合、変更なしと判断するべき', async () => {
      // ユーザーは既に最新のデータを持っている
      // masterProvidersDataを元に、Provider[]型に準拠したテストデータを作成します。
      // createMockProviderは部分的なオーバーライドを想定しており、
      // 型が完全でないマスターデータを直接渡すと型エラーになります。
      const userProviders: Provider[] = masterProvidersData.providers.map(p => ({
        id: `id-${p.name}`,
        name: p.name,
        displayName: p.displayName,
        models: p.models.map((m, i) => ({ id: `model-${p.name}-${i}`, name: m.name, order: i, enabled: true, isBuiltIn: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }));

      const { providers, hasChanged } = await (service as any).mergeProviders(
        userProviders
      );

      expect(hasChanged).toBe(false);
      expect(providers).toEqual(userProviders);
    });
  });

  describe('saveDraft', () => {
    it('ドラフトデータを保存する', async () => {
      const testDraftData = createMockDraftData();

      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.saveDraft(testDraftData);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [DRAFT_STORAGE_KEY]: testDraftData
      });
    });

    it('空のドラフトデータでも保存できる', async () => {
      const emptyDraftData = createMockDraftData({
        userPrompt: '',
        selectedPromptId: '',
        resultArea: '',
        selectedModelId: ''
      });

      mockChromeStorage.local.set.mockResolvedValue(undefined);

      await storageService.saveDraft(emptyDraftData);

      expect(mockChromeStorage.local.set).toHaveBeenCalledWith({
        [DRAFT_STORAGE_KEY]: emptyDraftData
      });
    });

    it('chrome.storage.local.setがエラーをスローした場合、エラーが伝播する', async () => {
      const testDraftData = createMockDraftData();
      const storageError = new Error('ストレージ保存失敗');
      mockChromeStorage.local.set.mockRejectedValue(storageError);

      await expect(storageService.saveDraft(testDraftData)).rejects.toThrow(
        storageError
      );
    });
  });

  describe('getDraft', () => {
    it('ドラフトデータを取得する', async () => {
      const testDraftData = createMockDraftData();

      mockChromeStorage.local.get.mockResolvedValue({
        [DRAFT_STORAGE_KEY]: testDraftData
      });

      const result = await storageService.getDraft();

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith([DRAFT_STORAGE_KEY]);
      expect(result).toEqual(testDraftData);
    });

    it('ドラフトデータが存在しない場合undefinedを返す', async () => {
      mockChromeStorage.local.get.mockResolvedValue({});

      const result = await storageService.getDraft();

      expect(mockChromeStorage.local.get).toHaveBeenCalledWith([DRAFT_STORAGE_KEY]);
      expect(result).toBeUndefined();
    });

    it('chrome.storage.local.getがエラーをスローした場合、エラーが伝播する', async () => {
      const storageError = new Error('ストレージ取得失敗');
      mockChromeStorage.local.get.mockRejectedValue(storageError);

      await expect(storageService.getDraft()).rejects.toThrow(
        storageError
      );
    });
  });
});