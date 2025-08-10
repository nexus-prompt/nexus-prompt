import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ImportExportService } from '../../services/import-export';
import type { AppData, Framework, Prompt, Provider, DraftData } from '../../types';

// StorageServiceのモック関数を作成
const mockGetAppData = vi.hoisted(() => vi.fn());
const mockSaveAppData = vi.hoisted(() => vi.fn());
const mockGetDraft = vi.hoisted(() => vi.fn());
const mockSaveDraft = vi.hoisted(() => vi.fn());

// StorageServiceのモック
vi.mock('../../services/storage', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    getAppData: mockGetAppData,
    saveAppData: mockSaveAppData,
    getDraft: mockGetDraft,
    saveDraft: mockSaveDraft,
  })),
  storageService: {
    getAppData: mockGetAppData,
    saveAppData: mockSaveAppData,
    getDraft: mockGetDraft,
    saveDraft: mockSaveDraft,
  },
}));

// crypto.randomUUID のモック
const mockRandomUUID = vi.hoisted(() => vi.fn());
Object.defineProperty(globalThis, 'crypto', {
  value: {
    randomUUID: mockRandomUUID,
  },
  writable: true,
});

// --- テストデータファクトリ ---
const createMockPrompt = (overrides: Partial<Prompt> = {}): Prompt => ({
  id: 'prompt1',
  content: {
    version: 2,
    id: 'prompt1',
    name: 'テストプロンプト',
    template: 'テスト内容',
    inputs: [],
    frameworkRef: 'framework1',
  },
  order: 1,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockFramework = (overrides: Partial<Framework> = {}): Framework => ({
  id: 'framework1',
  content: {
    version: 2,
    id: 'framework1',
    name: 'テストフレームワーク',
    content: 'テスト内容',
    slug: 'test-framework',
    metadata: {},
  },
  order: 1,
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockProvider = (overrides: Partial<Provider> = {}): Provider => ({
  id: 'provider1',
  name: 'Gemini',
  displayName: 'Google Gemini',
  models: [{ id: 'model1', name: 'gemini-2.0-flash', order: 1, enabled: true, isBuiltIn: true, createdAt: '2023-01-01T00:00:00.000Z', updatedAt: '2023-01-01T00:00:00.000Z' }],
  createdAt: '2023-01-01T00:00:00.000Z',
  updatedAt: '2023-01-01T00:00:00.000Z',
  ...overrides,
});

const createMockAppData = (overrides: Partial<AppData> = {}): AppData => ({
  providers: [createMockProvider()],
  frameworks: [createMockFramework()],
  prompts: [createMockPrompt()],
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

describe('ImportExportService', () => {
  let importExportService: ImportExportService;

  beforeEach(() => {
    // モックのリセット
    vi.clearAllMocks();
    
    // デフォルトのモック実装
    mockGetAppData.mockResolvedValue(createMockAppData());
    mockSaveAppData.mockResolvedValue(undefined);
    mockGetDraft.mockResolvedValue(createMockDraftData());
    mockSaveDraft.mockResolvedValue(undefined);
    mockRandomUUID.mockReturnValue('new-uuid');

    // 現在時刻のモック
    vi.setSystemTime(new Date('2023-12-01T00:00:00.000Z'));

    importExportService = new ImportExportService();
  });

  describe('exportData', () => {
    it('フレームワークデータをJSON形式でエクスポートする', async () => {
      const testFramework = createMockFramework({ id: 'original-id' });
      const testPrompt = createMockPrompt({ id: 'original-prompt-id' });
      const testAppData = createMockAppData({
        frameworks: [testFramework],
        prompts: [testPrompt],
      });

      mockGetAppData.mockResolvedValue(testAppData);

      const result = await importExportService.exportData();

      const exportedData = JSON.parse(result);
      
      // エクスポートされたデータの構造を確認
      expect(exportedData).toEqual({
        providers: [],
        frameworks: [
          {
            ...testFramework,
            id: '', // IDはクリアされる
            content: {
              ...testFramework.content,
              content: testFramework.content.content,
            },
          },
        ],
        settings: {
          defaultFrameworkId: '',
          version: '',
        },
      });

      expect(mockGetAppData).toHaveBeenCalledTimes(1);
    });

    it('複数のフレームワークとプロンプトを含むデータをエクスポートする', async () => {
      const testFrameworks = [
        createMockFramework({
          id: 'fw1',
          content: {
            ...createMockFramework().content,
            content: createMockFramework().content.content,
          },
        }),
        createMockFramework({
          id: 'fw2',
          content: {
            ...createMockFramework().content,
            content: createMockFramework().content.content,
          },
        }),
      ];
      const testAppData = createMockAppData({
        frameworks: testFrameworks,
      });

      mockGetAppData.mockResolvedValue(testAppData);

      const result = await importExportService.exportData();
      const exportedData = JSON.parse(result);

      expect(exportedData.frameworks).toHaveLength(2);
      expect(exportedData.prompts).toHaveLength(2);
      
      // すべてのIDがクリアされていることを確認
      exportedData.frameworks.forEach((framework: Framework) => {
        expect(framework.id).toBe('');
      });
      exportedData.prompts.forEach((prompt: Prompt) => {
        expect(prompt.id).toBe('');
      });
    });

    it('getAppDataがエラーをスローした場合、エラーが伝播する', async () => {
      const storageError = new Error('ストレージ取得失敗');
      mockGetAppData.mockRejectedValue(storageError);

      await expect(importExportService.exportData()).rejects.toThrow(
        storageError
      );
    });
  });

  describe('importData', () => {
    it('正しいJSON形式のデータをインポートする', async () => {
      const importData = {
        providers: [],
        frameworks: [
          {
            id: '', // インポート時はIDは空
            name: 'インポートフレームワーク',
            content: 'インポート内容',
            prompts: [
              {
                id: '', // インポート時はIDは空
                name: 'インポートプロンプト',
                content: 'インポートプロンプト内容',
                order: 1,
                createdAt: '2023-01-01T00:00:00.000Z',
                updatedAt: '2023-01-01T00:00:00.000Z',
              },
            ],
            order: 1,
            createdAt: '2023-01-01T00:00:00.000Z',
            updatedAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        settings: {
          defaultFrameworkId: '',
          version: '',
        },
      };

      const currentAppData = createMockAppData();
      mockGetAppData.mockResolvedValue(currentAppData);

      let uuidCallCount = 0;
      mockRandomUUID.mockImplementation(() => `new-uuid-${++uuidCallCount}`);

      await importExportService.importData(JSON.stringify(importData));

      // saveAppDataが正しい引数で呼ばれることを確認
      expect(mockSaveAppData).toHaveBeenCalledTimes(1);
      const savedData = mockSaveAppData.mock.calls[0][0] as AppData;

      // 現在のprovidersとsettingsが保持されることを確認
      expect(savedData.providers).toEqual(currentAppData.providers);
      expect(savedData.settings).toEqual(currentAppData.settings);

      // フレームワークデータが置き換えられることを確認
      expect(savedData.frameworks).toHaveLength(1);
      expect(savedData.frameworks[0].content.name).toBe('インポートフレームワーク');
      expect(savedData.frameworks[0].id).toBe('new-uuid-1'); // 新しいIDが割り当てられる
      expect(savedData.frameworks[0].createdAt).toBe('2023-12-01T00:00:00.000Z');
      expect(savedData.frameworks[0].updatedAt).toBe('2023-12-01T00:00:00.000Z');

      // プロンプトにも新しいIDが割り当てられることを確認
      expect(savedData.prompts[0].id).toBe('new-uuid-2');
      expect(savedData.prompts[0].createdAt).toBe('2023-12-01T00:00:00.000Z');
      expect(savedData.prompts[0].updatedAt).toBe('2023-12-01T00:00:00.000Z');
    });

    it('ドラフトデータが存在する場合、selectedPromptIdをクリアする', async () => {
      const importData = {
        frameworks: [createMockFramework()],
        providers: [],
        settings: { defaultFrameworkId: '', version: '' },
      };

      const currentDraft = createMockDraftData({ selectedPromptId: 'existing-prompt-id' });
      mockGetDraft.mockResolvedValue(currentDraft);

      await importExportService.importData(JSON.stringify(importData));

      expect(mockSaveDraft).toHaveBeenCalledTimes(1);
      const savedDraft = mockSaveDraft.mock.calls[0][0] as DraftData;
      expect(savedDraft.selectedPromptId).toBe('');
    });

    it('ドラフトデータが存在しない場合、saveDraftは呼ばれない', async () => {
      const importData = {
        frameworks: [createMockFramework()],
        providers: [],
        settings: { defaultFrameworkId: '', version: '' },
      };

      mockGetDraft.mockResolvedValue(null);

      await importExportService.importData(JSON.stringify(importData));

      expect(mockSaveDraft).not.toHaveBeenCalled();
    });

    it('不正なJSON文字列の場合、エラーをスローする', async () => {
      const invalidJson = '{ invalid json }';

      await expect(importExportService.importData(invalidJson)).rejects.toThrow(
        'インポートファイルの形式が正しくありません。'
      );
    });

    it('frameworksプロパティが存在しない場合、エラーをスローする', async () => {
      const invalidData = {
        providers: [],
        settings: { defaultFrameworkId: '', version: '' },
      };

      await expect(importExportService.importData(JSON.stringify(invalidData))).rejects.toThrow(
        'インポートデータはフレームワークの配列を含む正しい形式である必要があります。'
      );
    });

    it('frameworksが配列でない場合、エラーをスローする', async () => {
      const invalidData = {
        frameworks: 'not an array',
        providers: [],
        settings: { defaultFrameworkId: '', version: '' },
      };

      await expect(importExportService.importData(JSON.stringify(invalidData))).rejects.toThrow(
        'インポートデータはフレームワークの配列を含む正しい形式である必要があります。'
      );
    });

    it('nullが渡された場合、エラーをスローする', async () => {
      await expect(importExportService.importData('null')).rejects.toThrow(
        'インポートデータはフレームワークの配列を含む正しい形式である必要があります。'
      );
    });

    it('空のオブジェクトが渡された場合、エラーをスローする', async () => {
      await expect(importExportService.importData('{}')).rejects.toThrow(
        'インポートデータはフレームワークの配列を含む正しい形式である必要があります。'
      );
    });
  });
}); 