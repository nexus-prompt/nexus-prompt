import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SecureApiKeyManager } from '../secure-api-key-manager';

const BASE_API_KEY_STORAGE_KEY = 'nexus/apiKeys';

// Chrome runtime APIのモック
const mockChrome = {
  runtime: {
    id: 'test-extension-id-12345',
  },
  storage: {
    local: {
      get: vi.fn(),
      set: vi.fn(),
      remove: vi.fn(),
    },
  },
};

// crypto.subtle APIのモック
const mockCryptoSubtle = {
  digest: vi.fn(),
  importKey: vi.fn(),
  deriveKey: vi.fn(),
  encrypt: vi.fn(),
  decrypt: vi.fn(),
};

// crypto.getRandomValuesのモック
const mockGetRandomValues = vi.fn();

describe('SecureApiKeyManager', () => {
  let manager: SecureApiKeyManager;

  beforeEach(() => {
    vi.resetModules();
    manager = new SecureApiKeyManager(); // 新しいインスタンスを生成

    // グローバルオブジェクトのモック設定
    (globalThis as any).chrome = mockChrome;
    
    // vi.stubGlobalを使用してcryptoをモック
    vi.stubGlobal('crypto', {
      subtle: mockCryptoSubtle,
      getRandomValues: mockGetRandomValues,
    });

    // モックのリセット
    vi.clearAllMocks();
    
    // デフォルトのモック動作を設定
    mockGetRandomValues.mockImplementation((array: Uint8Array) => {
      // 固定値で配列を埋める（テスト用）
      for (let i = 0; i < array.length; i++) {
        array[i] = i % 256;
      }
      return array;
    });

    manager = new SecureApiKeyManager();
  });

  describe('getStorageKey', () => {
    it('プロバイダー名から小文字のストレージキーを生成する', () => {
      // (manager as any) を使ってプライベートメソッドをテスト
      const key1 = (manager as any).getStorageKey('Gemini');
      expect(key1).toBe(`${BASE_API_KEY_STORAGE_KEY}/gemini`);

      const key2 = (manager as any).getStorageKey('Claude');
      expect(key2).toBe(`${BASE_API_KEY_STORAGE_KEY}/claude`);
    });
  });

  describe('generateKeyMaterial', () => {
    it('キーマテリアルを生成する', async () => {
      const mockHashBuffer = new ArrayBuffer(32);
      const mockCryptoKey = {} as CryptoKey;

      mockCryptoSubtle.digest.mockResolvedValue(mockHashBuffer);
      mockCryptoSubtle.importKey.mockResolvedValue(mockCryptoKey);

      const result = await manager.generateKeyMaterial();

      // 実際に渡されたデータが期待される値であることを確認
      const callArgs = mockCryptoSubtle.digest.mock.calls[0];
      const actualData = callArgs[1] as Uint8Array;
      const expectedData = new TextEncoder().encode('test-extension-id-12345');
      expect(actualData).toEqual(expectedData);
      
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledWith(
        'raw',
        mockHashBuffer,
        { name: 'PBKDF2' },
        false,
        ['deriveBits', 'deriveKey']
      );
      expect(result).toBe(mockCryptoKey);
    });

    it('キーマテリアルをキャッシュする', async () => {
      const mockHashBuffer = new ArrayBuffer(32);
      const mockCryptoKey = {} as CryptoKey;

      mockCryptoSubtle.digest.mockResolvedValue(mockHashBuffer);
      mockCryptoSubtle.importKey.mockResolvedValue(mockCryptoKey);

      const result1 = await manager.generateKeyMaterial();
      const result2 = await manager.generateKeyMaterial();

      expect(result1).toBe(result2);
      expect(mockCryptoSubtle.digest).toHaveBeenCalledTimes(1);
      expect(mockCryptoSubtle.importKey).toHaveBeenCalledTimes(1);
    });
  });

  describe('deriveKey', () => {
    it('ソルトを使用してキーを派生する', async () => {
      const mockKeyMaterial = {} as CryptoKey;
      const mockDerivedKey = {} as CryptoKey;
      const salt = new Uint8Array([1, 2, 3, 4]);

      mockCryptoSubtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockCryptoSubtle.importKey.mockResolvedValue(mockKeyMaterial);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);

      const result = await manager.deriveKey(salt);

      expect(mockCryptoSubtle.deriveKey).toHaveBeenCalledWith(
        {
          name: 'PBKDF2',
          salt: salt,
          iterations: 100000,
          hash: 'SHA-256'
        },
        mockKeyMaterial,
        {
          name: 'AES-GCM',
          length: 256
        },
        false,
        ['encrypt', 'decrypt']
      );
      expect(result).toBe(mockDerivedKey);
    });
  });

  describe('saveApiKey', () => {
    it('APIキーを暗号化して保存する', async () => {
      const apiKey = 'test-api-key';
      const mockEncryptedData = new ArrayBuffer(16);
      const mockDerivedKey = {} as CryptoKey;

      mockCryptoSubtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockCryptoSubtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);
      mockCryptoSubtle.encrypt.mockResolvedValue(mockEncryptedData);
      mockChrome.storage.local.set.mockResolvedValue(undefined);

      const result = await manager.saveApiKey("Gemini", apiKey);

      // 実際に渡されたデータが期待される値であることを確認
      const encryptCallArgs = mockCryptoSubtle.encrypt.mock.calls[0];
      const encryptOptions = encryptCallArgs[0];
      const encryptKey = encryptCallArgs[1];
      const encryptData = encryptCallArgs[2] as Uint8Array;
      
      expect(encryptOptions.name).toBe('AES-GCM');
      expect(encryptOptions.iv).toEqual(new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])); // mockGetRandomValuesの固定値
      expect(encryptKey).toBe(mockDerivedKey);
      expect(encryptData).toEqual(new TextEncoder().encode(apiKey));
      
      expect(mockChrome.storage.local.set).toHaveBeenCalledWith({
        [`${BASE_API_KEY_STORAGE_KEY}/gemini`]: expect.stringContaining('"version":3')
      });
      expect(result).toBe(true);
    });

    it('暗号化に失敗した場合はfalseを返す', async () => {
      const apiKey = 'test-api-key';

      mockCryptoSubtle.digest.mockRejectedValue(new Error('暗号化エラー'));

      const result = await manager.saveApiKey("Gemini", apiKey);

      expect(result).toBe(false);
    });
  });

  describe('getApiKey', () => {
    it('指定したプロバイダーの暗号化されたAPIキーを復号化して取得する', async () => {
      const expectedApiKey = 'test-api-key';
      const mockStoredData = {
        encrypted: [1, 2, 3, 4],
        salt: [5, 6, 7, 8],
        iv: [9, 10, 11, 12],
        timestamp: Date.now(),
        version: 3
      };
      const mockDecryptedData = new TextEncoder().encode(expectedApiKey);
      const mockDerivedKey = {} as CryptoKey;

      mockChrome.storage.local.get.mockResolvedValue({
        [`${BASE_API_KEY_STORAGE_KEY}/gemini`]: JSON.stringify(mockStoredData)
      });
      mockCryptoSubtle.digest.mockResolvedValue(new ArrayBuffer(32));
      mockCryptoSubtle.importKey.mockResolvedValue({} as CryptoKey);
      mockCryptoSubtle.deriveKey.mockResolvedValue(mockDerivedKey);
      mockCryptoSubtle.decrypt.mockResolvedValue(mockDecryptedData);

      const result = await manager.getApiKey('Gemini');

      // 実際に渡されたデータが期待される値であることを確認
      const decryptCallArgs = mockCryptoSubtle.decrypt.mock.calls[0];
      const decryptOptions = decryptCallArgs[0];
      const decryptKey = decryptCallArgs[1];
      const decryptData = decryptCallArgs[2] as Uint8Array;
      
      expect(decryptOptions.name).toBe('AES-GCM');
      expect(decryptOptions.iv).toEqual(new Uint8Array([9, 10, 11, 12])); // mockStoredDataのivから復元
      expect(decryptKey).toBe(mockDerivedKey);
      expect(decryptData).toEqual(new Uint8Array([1, 2, 3, 4])); // mockStoredDataのencryptedから復元
      
      expect(result).toBe(expectedApiKey);
    });

    it('古いバージョンのデータの場合はnullを返す', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const providerName = 'Gemini';
      const storageKey = `${BASE_API_KEY_STORAGE_KEY}/${providerName.toLowerCase()}`;
      const mockStoredData = {
        encrypted: [1, 2, 3, 4],
        salt: [5, 6, 7, 8],
        iv: [9, 10, 11, 12],
        timestamp: Date.now(),
        version: 2 // 古いバージョン
      };

      mockChrome.storage.local.get.mockResolvedValue({
        [storageKey]: JSON.stringify(mockStoredData)
      });

      const result = await manager.getApiKey(providerName);

      expect(result).toBeNull();
      expect(consoleWarnSpy).toHaveBeenCalledWith('古いバージョンのデータです');
      consoleWarnSpy.mockRestore();
    });

    it('キーの派生に失敗した場合はnullを返す', async () => {
      const mockStoredData = {
        encrypted: [1, 2, 3, 4],
        salt: [5, 6, 7, 8],
        iv: [9, 10, 11, 12],
        timestamp: Date.now(),
        version: 3,
      };

      mockChrome.storage.local.get.mockResolvedValue({
        [`${BASE_API_KEY_STORAGE_KEY}/gemini`]: JSON.stringify(mockStoredData),
      });
      // deriveKeyが失敗するケースをシミュレート
      mockCryptoSubtle.deriveKey.mockRejectedValue(new Error('キー派生エラー'));

      const result = await manager.getApiKey('Gemini');

      expect(result).toBeNull();
    });

    it.each([
      { case: 'データが全く存在しない', providerName: 'Gemini', mockReturnValue: {} },
      { case: '指定したプロバイダーのキーが存在しない', providerName: 'NonExistentProvider', mockReturnValue: { [`${BASE_API_KEY_STORAGE_KEY}/gemini`]: 'some_data' } },
    ])('$case場合、nullを返す', async ({ providerName, mockReturnValue }) => {
      mockChrome.storage.local.get.mockResolvedValue(mockReturnValue);

      const apiKey = await manager.getApiKey(providerName);

      expect(apiKey).toBeNull();
    });
  });

  describe('clearApiKey', () => {
    it('APIキーをクリアする', async () => {
      mockChrome.storage.local.remove.mockResolvedValue(undefined);

      await manager.clearApiKey('Gemini');

      expect(mockChrome.storage.local.remove).toHaveBeenCalledWith([
        `${BASE_API_KEY_STORAGE_KEY}/gemini`
      ]);
    });
  });
}); 