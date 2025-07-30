import type { GeminiResponse } from '../types';
import { ApiKeyAuthenticationError } from './api-errors';
import { BaseApiService } from './base-api.service';

export const GeminiApiServiceName = 'Gemini';

// Gemini APIとの通信を行うサービス
export class GeminiApiService extends BaseApiService {
  private readonly API_URL_TEMPLATE = 'https://generativelanguage.googleapis.com/v1beta/models/{modelName}:generateContent';

  /**
   * Gemini APIを呼び出してテキストを生成
   */
  async generateContent(prompt: string, apiKey: string, modelName: string): Promise<string> {
    const url = `${this.API_URL_TEMPLATE.replace('{modelName}', modelName)}?key=${apiKey}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });

    if (!response.ok) {
      // 401 Unauthorized または 403 Forbidden の場合は、APIキーが原因である可能性が高い
      if (response.status === 401 || response.status === 403) {
        throw new ApiKeyAuthenticationError('Gemini APIキーが正しくないか、権限がありません。設定を確認してください。');
      }
      // その他のエラー
      throw new Error(`Gemini APIエラー: ${response.status}`);
    }

    const data = await response.json() as GeminiResponse;
    return data.candidates[0].content.parts[0].text;
  }
}
