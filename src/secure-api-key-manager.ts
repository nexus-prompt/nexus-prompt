// API キー暗号化管理クラス
export class SecureApiKeyManager {
  private baseStorageKey = 'nexus/apiKeys';
  private keyMaterial: CryptoKey | null = null;

  private getStorageKey(providerName: string): string {
    return `${this.baseStorageKey}/${providerName.toLowerCase()}`;
  }

  // 拡張機能固有のキーマテリアルを生成
  async generateKeyMaterial(): Promise<CryptoKey> {
    if (this.keyMaterial) return this.keyMaterial;

    const extensionId = chrome.runtime.id;
    // Service Workerでは `navigator.userAgent` にアクセスできないため、
    // 拡張機能IDのみをキーマテリアルの生成に使用します。
    // 拡張機能IDはインストールごとに一意であるため、十分なエントロピーを提供します。
    const staticData = extensionId;
    
    // 静的データをハッシュ化してキーマテリアルとして使用
    const encoder = new TextEncoder();
    const data = encoder.encode(staticData);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    
    // キーマテリアルをCryptoKeyオブジェクトとしてインポート
    this.keyMaterial = await crypto.subtle.importKey(
      'raw',
      hashBuffer,
      { name: 'PBKDF2' },
      false,
      ['deriveBits', 'deriveKey']
    );
    
    return this.keyMaterial;
  }

  // ソルトを使用して暗号化キーを派生
  async deriveKey(salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await this.generateKeyMaterial();
    
    return await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false, // extractable = false（キーを抽出不可能に）
      ['encrypt', 'decrypt']
    );
  }

  // APIキーを暗号化して保存
  async saveApiKey(providerName: string, apiKey: string): Promise<boolean> {
    try {
      // ランダムソルトとIVを生成
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // キーを派生
      const key = await this.deriveKey(salt);
      
      // APIキーを暗号化
      const encoder = new TextEncoder();
      // APIキーの前後の空白を削除してからエンコードする
      const data = encoder.encode(apiKey.trim());
      
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );
      
      // 暗号化されたデータ、ソルト、IVを保存
      const dataToStore = {
        encrypted: Array.from(new Uint8Array(encryptedData)),
        salt: Array.from(salt),
        iv: Array.from(iv),
        timestamp: Date.now(),
        version: 3
      };
      
      const storageKey = this.getStorageKey(providerName);
      await chrome.storage.local.set({
        [storageKey]: JSON.stringify(dataToStore)
      });
      
      return true;
    } catch (error) {
      console.warn('APIキーの保存に失敗:', error);
      return false;
    }
  }

  // APIキーを復号化して取得
  async getApiKey(providerName: string): Promise<string | null> {
    try {
      const storageKey = this.getStorageKey(providerName);
      const result = await chrome.storage.local.get([storageKey]);
      if (!result[storageKey]) return null;
      
      const storedData = JSON.parse(result[storageKey]);
      
      // バージョンチェック
      if (storedData.version !== 3) {
        console.warn('古いバージョンのデータです');
        return null;
      }
      
      // 配列からUint8Arrayに変換
      const encryptedData = new Uint8Array(storedData.encrypted);
      const salt = new Uint8Array(storedData.salt);
      const iv = new Uint8Array(storedData.iv);
      
      // キーを派生
      const key = await this.deriveKey(salt);
      
      // データを復号化
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedData
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
      
    } catch (error) {
      console.warn('APIキーの取得に失敗:', error);
      return null;
    }
  }

  async clearApiKey(providerName: string): Promise<void> {
    const storageKey = this.getStorageKey(providerName);
    await chrome.storage.local.remove([storageKey]);
  }
} 