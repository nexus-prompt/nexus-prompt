import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AnthropicResponse } from '../../types';
import { AnthropicApiService } from '../../services/anthropic-api';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('AnthropicApiService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateContent', () => {
    it('正常なレスポンスを受信した場合、テキストを返す', async () => {
      const mockResponse: AnthropicResponse = {
        content: [
          {
            text: 'Generated text response'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const anthropicApiService = new AnthropicApiService();
      const result = await anthropicApiService.generateContent('test prompt', 'test-api-key', 'claude-3-5-haiku-latest');

      expect(result).toBe('Generated text response');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'x-api-key': 'test-api-key'
          },
          body: JSON.stringify({
            model: 'claude-3-5-haiku-latest',
            max_tokens: 4000,
            messages: [{
              role: 'user',
              content: 'test prompt'
            }],
          })
        }
      );
    });

    it('APIエラーが発生した場合、エラーをスローする', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400
      });

      const anthropicApiService = new AnthropicApiService();
      await expect(
        anthropicApiService.generateContent('test prompt', 'test-api-key', 'claude-3-5-haiku-latest')
      ).rejects.toThrow('Anthropic APIエラー: 400');
    });

    it('ネットワークエラーが発生した場合、エラーをスローする', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const anthropicApiService = new AnthropicApiService();
      await expect(
        anthropicApiService.generateContent('test prompt', 'test-api-key', 'claude-3-5-haiku-latest')
      ).rejects.toThrow('Network error');
    });

    it('正しいAPIエンドポイントとパラメータでリクエストを送信する', async () => {
      const mockResponse: AnthropicResponse = {
        content: [
          {
            text: 'Response'
          }
        ]
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      });

      const prompt = 'Complex prompt with special characters: @#$%^&*()';
      const apiKey = 'complex-api-key-123';

      const anthropicApiService = new AnthropicApiService();
      await anthropicApiService.generateContent(prompt, apiKey, 'claude-3-5-haiku-latest');

      const expectedUrl = `https://api.anthropic.com/v1/messages`;
      const expectedBody = {
        model: 'claude-3-5-haiku-latest',
        max_tokens: 4000,
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
            'anthropic-version': '2023-06-01',
            'anthropic-dangerous-direct-browser-access': 'true',
            'x-api-key': 'complex-api-key-123'
          },
          body: JSON.stringify(expectedBody)
        }
      );
    });
  });
});

describe('improvePromptWithAnthropic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('プロンプト改善のための適切なプロンプトを生成してAPIを呼び出す', async () => {
    const mockResponse: AnthropicResponse = {
      content: [
        {
          text: 'Improved prompt text'
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

    const anthropicApiService = new AnthropicApiService();
    const result = await anthropicApiService.improvePrompt(
      userPrompt,
      selectedPrompt,
      frameworkContent,
      apiKey,
      'claude-3-5-haiku-latest'
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
    const mockResponse: AnthropicResponse = {
      content: [
        {
          text: 'Improved empty prompt'
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const anthropicApiService = new AnthropicApiService();
    const result = await anthropicApiService.improvePrompt('', '', '', 'test-api-key', 'claude-3-5-haiku-latest');

    expect(result).toBe('Improved empty prompt');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('APIエラーが発生した場合、エラーをスローする', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401
    });

    const anthropicApiService = new AnthropicApiService();
    await expect(
      anthropicApiService.improvePrompt('prompt', 'selected', 'framework', 'invalid-key', 'claude-3-5-haiku-latest')
    ).rejects.toThrow('Anthropic APIキーが正しくないか、権限がありません。設定を確認してください。');
  });

  it('特殊文字を含む入力でも適切に処理する', async () => {
    const mockResponse: AnthropicResponse = {
      content: [
        {
          text: 'Processed special characters'
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

    const anthropicApiService = new AnthropicApiService();
    const result = await anthropicApiService.improvePrompt(
      userPrompt,
      selectedPrompt,
      frameworkContent,
      'test-api-key',
      'claude-3-5-haiku-latest'
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
    const mockResponse: AnthropicResponse = {
      content: [
        {
          text: 'Processed long text'
        }
      ]
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse)
    });

    const longText = 'A'.repeat(1000);
    const anthropicApiService = new AnthropicApiService();
    const result = await anthropicApiService.improvePrompt(
      longText,
      longText,
      longText,
      'test-api-key',
      'claude-3-5-haiku-latest'
    );

    expect(result).toBe('Processed long text');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
}); 