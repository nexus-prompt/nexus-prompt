import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { OpenAIResponse } from '../../types';
import { OpenAIApiService } from '../../services/openai-api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('OpenAIApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateContent', () => {
    it('正常なレスポンスを受信した場合、テキストを返す', async () => {
      const mockResponse: OpenAIResponse = {
        choices: [
          {
            message: {
              content: 'Generated text response'
            }
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const openaiApiService = new OpenAIApiService();
      const result = await openaiApiService.generateContent('test prompt', 'test-api-key', 'gpt-4o-mini');

      expect(result).toBe('Generated text response');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.openai.com/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-api-key'
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{
              role: 'user',
              content: 'test prompt'
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

      const openaiApiService = new OpenAIApiService();
      await expect(
        openaiApiService.generateContent('test prompt', 'test-api-key', 'gpt-4o-mini')
      ).rejects.toThrow('OpenAI APIエラー: 400');
    });

    it('ネットワークエラーが発生した場合、エラーをスローする', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const openaiApiService = new OpenAIApiService();
      await expect(
        openaiApiService.generateContent('test prompt', 'test-api-key', 'gpt-4o-mini')
      ).rejects.toThrow('Network error');
    });

    it('正しいAPIエンドポイントとパラメータでリクエストを送信する', async () => {
      const mockResponse: OpenAIResponse = {
        choices: [
          {
            message: {
              content: 'Response'
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

      const openaiApiService = new OpenAIApiService();
      await openaiApiService.generateContent(prompt, apiKey, 'gpt-4o-mini');

      const expectedUrl = `https://api.openai.com/v1/chat/completions`;
      const expectedBody = {
        model: 'gpt-4o-mini',
        messages: [{
          role: 'user',
          content: prompt
        }]
      };

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer complex-api-key-123'
          },
          body: JSON.stringify(expectedBody)
        }
      );
    });
  });
});

describe('improvePromptWithOpenAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('プロンプト改善のための適切なプロンプトを生成してAPIを呼び出す', async () => {
    const mockResponse: OpenAIResponse = {
      choices: [
        {
          message: {
            content: 'Improved prompt text'
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

    const openaiApiService = new OpenAIApiService();
    const result = await openaiApiService.improvePrompt(
      userPrompt,
      selectedPrompt,
      frameworkContent,
      apiKey,
      'gpt-4o-mini'
    );

    expect(result).toBe('Improved prompt text');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // リクエストボディを確認
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const sentPrompt = requestBody.messages[0].content;

    // 送信されたプロンプトに必要な要素が含まれているか確認
    expect(sentPrompt).toContain('# 命令(Instruction)');
    expect(sentPrompt).toContain('# 優れたプロンプトの例 (Good Prompt Example)');
    expect(sentPrompt).toContain('<example>');
    expect(sentPrompt).toContain('</example>');
    expect(sentPrompt).toContain('<user_prompt>');
    expect(sentPrompt).toContain('<framework>');
    expect(sentPrompt).toContain(userPrompt);
    expect(sentPrompt).toContain(selectedPrompt);
    expect(sentPrompt).toContain(frameworkContent);
  });

  it('空の入力でも適切に処理する', async () => {
    const mockResponse: OpenAIResponse = {
      choices: [
        {
          message: {
            content: 'Improved empty prompt'
          }
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const openaiApiService = new OpenAIApiService();
    const result = await openaiApiService.improvePrompt('', '', '', 'test-api-key', 'gpt-4o-mini');

    expect(result).toBe('Improved empty prompt');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('APIエラーが発生した場合、エラーをスローする', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401
    });

    const openaiApiService = new OpenAIApiService();
    await expect(
      openaiApiService.improvePrompt('prompt', 'selected', 'framework', 'invalid-key', 'gpt-4o-mini')
    ).rejects.toThrow('OpenAI APIキーが正しくないか、権限がありません。設定を確認してください。');
  });

  it('特殊文字を含む入力でも適切に処理する', async () => {
    const mockResponse: OpenAIResponse = {
      choices: [
        {
          message: {
            content: 'Processed special characters'
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

    const openaiApiService = new OpenAIApiService();
    const result = await openaiApiService.improvePrompt(
      userPrompt,
      selectedPrompt,
      frameworkContent,
      'test-api-key',
      'gpt-4o-mini'
    );

    expect(result).toBe('Processed special characters');
    
    // 特殊文字が正しくエスケープされて送信されているか確認
    const callArgs = mockFetch.mock.calls[0];
    const requestBody = JSON.parse(callArgs[1].body);
    const sentPrompt = requestBody.messages[0].content;

    expect(sentPrompt).toContain(userPrompt);
    expect(sentPrompt).toContain(selectedPrompt);
    expect(sentPrompt).toContain(frameworkContent);
  });

  it('長いテキストでも適切に処理する', async () => {
    const mockResponse: OpenAIResponse = {
      choices: [
        {
          message: {
            content: 'Processed long text'
          }
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const longText = 'A'.repeat(1000);
    const openaiApiService = new OpenAIApiService();
    const result = await openaiApiService.improvePrompt(
      longText,
      longText,
      longText,
      'test-api-key',
      'gpt-4o-mini'
    );

    expect(result).toBe('Processed long text');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
}); 