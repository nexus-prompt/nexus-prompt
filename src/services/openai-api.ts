import type { OpenAIResponse } from '../types';
import { ApiKeyAuthenticationError } from './api-errors';
import { BaseApiService } from './base-api.service';

export const OpenAIApiServiceName = 'OpenAI';

// OpenAI APIとの通信を行うサービス
export class OpenAIApiService extends BaseApiService {
  private readonly API_URL = 'https://api.openai.com/v1/chat/completions';

  /**
   * OpenAI APIを呼び出してテキストを生成
   */
  async generateContent(prompt: string, apiKey: string, modelName: string): Promise<string> {
    const response = await fetch(this.API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey.trim()}`
      },
      body: JSON.stringify({
        model: modelName,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      // 401 Unauthorized または 403 Forbidden の場合は、APIキーが原因である可能性が高い
      if (response.status === 401 || response.status === 403) {
        throw new ApiKeyAuthenticationError('OpenAI APIキーが正しくないか、権限がありません。設定を確認してください。');
      }
      // その他のエラー
      throw new Error(`OpenAI APIエラー: ${response.status}`);
    }

    const data = await response.json() as OpenAIResponse;
    return data.choices[0].message.content;
  }
} 