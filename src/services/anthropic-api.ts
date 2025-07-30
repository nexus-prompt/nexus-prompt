import type { AnthropicResponse } from '../types';
import { ApiKeyAuthenticationError } from './api-errors';
import { BaseApiService } from './base-api.service';

export const AnthropicApiServiceName = 'Anthropic';

// Anthropic APIとの通信を行うサービス
export class AnthropicApiService extends BaseApiService {
  private readonly API_URL = 'https://api.anthropic.com/v1/messages';
  private readonly API_VERSION = '2023-06-01';

  /**
   * Anthropic APIを呼び出してテキストを生成
   */
  async generateContent(prompt: string, apiKey: string, modelName: string): Promise<string> {
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey.trim(),
        'anthropic-version': this.API_VERSION,
        /**
         * [!] 'anthropic-dangerous-direct-browser-access' ヘッダーについて
         * このヘッダーは、ブラウザから直接APIキーを送信する際のセキュリティリスクを開発者に警告するものです。
         * 一般的なWebサイトではAPIキーが漏洩する危険があるため、このヘッダーの使用は非推奨とされています。
         *
         * しかし、この拡張機能では以下の理由により、このヘッダーの使用が正当化されます。
         * 1. **ユーザー自身のAPIキー**: 使用されるAPIキーは開発者のものではなく、ユーザーが自己責任で提供したものです。
         * 2. **安全な実行コンテキスト**: API呼び出しは、通常のWebページよりも隔離され安全なService Workerから行われます。
         *
         * 以上の理由から、このアプリケーションのアーキテクチャにおいては、このヘッダーを'true'に設定することが適切と判断しています。
         */
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      // 401 Unauthorized または 403 Forbidden の場合は、APIキーが原因である可能性が高い
      if (response.status === 401 || response.status === 403) {
        throw new ApiKeyAuthenticationError('Anthropic APIキーが正しくないか、権限がありません。設定を確認してください。');
      }
      // その他のエラー
      throw new Error(`Anthropic APIエラー: ${response.status}`);
    }

    const data = await response.json() as AnthropicResponse;
    return data.content[0].text;
  }
} 