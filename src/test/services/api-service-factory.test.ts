import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ApiServiceFactory } from '../../services/api-service-factory';

const mockGeminiService = vi.hoisted(() => vi.fn().mockImplementation(() => ({
  generateContent: vi.fn(),
  improvePrompt: vi.fn(),
})));

const mockOpenAIService = vi.hoisted(() => vi.fn().mockImplementation(() => ({
  generateContent: vi.fn(),
  improvePrompt: vi.fn(),
})));

const mockAnthropicService = vi.hoisted(() => vi.fn().mockImplementation(() => ({
  generateContent: vi.fn(),
  improvePrompt: vi.fn(),
})));

vi.mock('../../services/gemini-api', () => ({
  GeminiApiService: mockGeminiService,
  GeminiApiServiceName: 'Gemini',
}));

vi.mock('../../services/openai-api', () => ({
  OpenAIApiService: mockOpenAIService,
  OpenAIApiServiceName: 'OpenAI',
}));

vi.mock('../../services/anthropic-api', () => ({
  AnthropicApiService: mockAnthropicService,
  AnthropicApiServiceName: 'Anthropic',
}));

describe('ApiServiceFactory', () => {
  let factory: ApiServiceFactory;

  beforeEach(() => {
    // モックのリセット
    vi.clearAllMocks();
    
    factory = new ApiServiceFactory();
  });

  describe('create', () => {
    it('Geminiプロバイダーの場合、GeminiApiServiceのインスタンスを返す', async () => {
      const service = await factory.create('Gemini');

      expect(mockGeminiService).toHaveBeenCalledTimes(1);
      expect(service).toBeDefined();
      expect(typeof service.generateContent).toBe('function');
      expect(typeof service.improvePrompt).toBe('function');
    });

    it('OpenAIプロバイダーの場合、OpenAIApiServiceのインスタンスを返す', async () => {
      const service = await factory.create('OpenAI');

      expect(mockOpenAIService).toHaveBeenCalledTimes(1);
      expect(service).toBeDefined();
      expect(typeof service.generateContent).toBe('function');
      expect(typeof service.improvePrompt).toBe('function');
    });

    it('Anthropicプロバイダーの場合、AnthropicApiServiceのインスタンスを返す', async () => {
      const service = await factory.create('Anthropic');

      expect(mockAnthropicService).toHaveBeenCalledTimes(1);
      expect(service).toBeDefined();
      expect(typeof service.generateContent).toBe('function');
      expect(typeof service.improvePrompt).toBe('function');
    });

    it('サポートされていないプロバイダーの場合、エラーをスローする', async () => {
      const unsupportedProvider = 'UnsupportedProvider';

      await expect(factory.create(unsupportedProvider)).rejects.toThrow(
        `Unsupported provider: ${unsupportedProvider}`
      );
    });

    it('空文字列のプロバイダーの場合、エラーをスローする', async () => {
      await expect(factory.create('')).rejects.toThrow(
        'Unsupported provider: '
      );
    });

    it('大文字小文字が異なるプロバイダー名の場合、エラーをスローする', async () => {
      await expect(factory.create('gemini')).rejects.toThrow(
        'Unsupported provider: gemini'
      );
      
      await expect(factory.create('GEMINI')).rejects.toThrow(
        'Unsupported provider: GEMINI'
      );
    });

    it('複数回呼び出した場合、それぞれ新しいインスタンスを返す', async () => {
      const service1 = await factory.create('Gemini');
      const service2 = await factory.create('Gemini');

      expect(mockGeminiService).toHaveBeenCalledTimes(2);
      expect(service1).toBeDefined();
      expect(service2).toBeDefined();
    });

    it('異なるプロバイダーを連続で呼び出した場合、それぞれ適切なサービスを返す', async () => {
      const geminiService = await factory.create('Gemini');
      const openaiService = await factory.create('OpenAI');
      const anthropicService = await factory.create('Anthropic');

      expect(mockGeminiService).toHaveBeenCalledTimes(1);
      expect(mockOpenAIService).toHaveBeenCalledTimes(1);
      expect(mockAnthropicService).toHaveBeenCalledTimes(1);
      
      expect(geminiService).toBeDefined();
      expect(openaiService).toBeDefined();
      expect(anthropicService).toBeDefined();
    });
  });
}); 