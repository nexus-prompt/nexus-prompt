import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { GeminiResponse } from '../../types';
import { GeminiApiService } from '../../services/gemini-api';

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('GeminiApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateContent', () => {
    it('正常なレスポンスを受信した場合、テキストを返す', async () => {
      const mockResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Generated text response'
                }
              ]
            }
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const geminiApiService = new GeminiApiService();
      const result = await geminiApiService.generateContent('test prompt', 'test-api-key', 'gemini-2.0-flash');

      expect(result).toBe('Generated text response');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=test-api-key',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'test prompt'
              }]
            }]
          })
        }
      );
    });

    it('APIエラーが発生した場合、エラーをスローする', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400
      });

      const geminiApiService = new GeminiApiService();
      await expect(
        geminiApiService.generateContent('test prompt', 'test-api-key', 'gemini-2.0-flash')
      ).rejects.toThrow('Gemini APIエラー: 400');
    });

    it('ネットワークエラーが発生した場合、エラーをスローする', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const geminiApiService = new GeminiApiService();
      await expect(
        geminiApiService.generateContent('test prompt', 'test-api-key', 'gemini-2.0-flash')
      ).rejects.toThrow('Network error');
    });

    it('正しいAPIエンドポイントとパラメータでリクエストを送信する', async () => {
      const mockResponse: GeminiResponse = {
        candidates: [
          {
            content: {
              parts: [
                {
                  text: 'Response'
                }
              ]
            }
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const prompt = 'Complex prompt with special characters: @#$%^&*()';
      const apiKey = 'complex-api-key-123';

      const geminiApiService = new GeminiApiService();
      await geminiApiService.generateContent(prompt, apiKey, 'gemini-2.0-flash');

      const expectedUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const expectedBody = {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      };

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(expectedBody)
        }
      );
    });
  });
});

describe('improvePromptWithGemini', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('プロンプト改善のための適切なプロンプトを生成してAPIを呼び出す', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Improved prompt text'
              }
            ]
          }
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const userPrompt = 'How to code?';
    const selectedPrompt = 'Write a Python function';
    const frameworkContent = 'Framework guidelines';
    const apiKey = 'test-api-key';

    const geminiApiService = new GeminiApiService();
    const result = await geminiApiService.improvePrompt(
      userPrompt,
      selectedPrompt,
      frameworkContent,
      apiKey,
      'gemini-2.0-flash'
    );

    expect(result).toBe('Improved prompt text');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // リクエストボディを確認
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const sentPrompt = requestBody.contents[0].parts[0].text;

    // 送信されたプロンプトに必要な要素が含まれているか確認
    expect(sentPrompt).toContain('# タスク');
    expect(sentPrompt).toContain('# LLMプロンプトの具体例');
    expect(sentPrompt).toContain('# 改善したいプロンプト');
    expect(sentPrompt).toContain('# フレームワーク情報');
    expect(sentPrompt).toContain(userPrompt);
    expect(sentPrompt).toContain(selectedPrompt);
    expect(sentPrompt).toContain(frameworkContent);
  });

  it('空の入力でも適切に処理する', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Improved empty prompt'
              }
            ]
          }
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const geminiApiService = new GeminiApiService();
    const result = await geminiApiService.improvePrompt('', '', '', 'test-api-key', 'gemini-2.0-flash');

    expect(result).toBe('Improved empty prompt');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('APIエラーが発生した場合、エラーをスローする', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401
    });

    const geminiApiService = new GeminiApiService();
    await expect(
      geminiApiService.improvePrompt('prompt', 'selected', 'framework', 'invalid-key', 'gemini-2.0-flash')
    ).rejects.toThrow('Gemini APIキーが正しくないか、権限がありません。設定を確認してください。');
  });

  it('特殊文字を含む入力でも適切に処理する', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Processed special characters'
              }
            ]
          }
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const userPrompt = 'プロンプト with "quotes" and `backticks`';
    const selectedPrompt = 'Selected prompt with \n newlines';
    const frameworkContent = 'Framework with ${variables}';

    const geminiApiService = new GeminiApiService();
    const result = await geminiApiService.improvePrompt(
      userPrompt,
      selectedPrompt,
      frameworkContent,
      'test-api-key',
      'gemini-2.0-flash'
    );

    expect(result).toBe('Processed special characters');
    
    // 特殊文字が正しくエスケープされて送信されているか確認
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const sentPrompt = requestBody.contents[0].parts[0].text;

    expect(sentPrompt).toContain(userPrompt);
    expect(sentPrompt).toContain(selectedPrompt);
    expect(sentPrompt).toContain(frameworkContent);
  });

  it('長いテキストでも適切に処理する', async () => {
    const mockResponse: GeminiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: 'Processed long text'
              }
            ]
          }
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const longText = 'A'.repeat(1000);
    const geminiApiService = new GeminiApiService();
    const result = await geminiApiService.improvePrompt(
      longText,
      longText,
      longText,
      'test-api-key',
      'gemini-2.0-flash'
    );

    expect(result).toBe('Processed long text');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
}); 