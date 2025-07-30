import type { Api } from '../types';
import { GeminiApiService, GeminiApiServiceName } from './gemini-api';
import { OpenAIApiService, OpenAIApiServiceName } from './openai-api';
import { AnthropicApiService, AnthropicApiServiceName } from './anthropic-api';

type ApiConstructor = new () => Api;

export class ApiServiceFactory {
  private readonly apiMap: Map<string, ApiConstructor>;

  constructor() {
    this.apiMap = new Map<string, ApiConstructor>([
      [GeminiApiServiceName, GeminiApiService],
      [OpenAIApiServiceName, OpenAIApiService],
      [AnthropicApiServiceName, AnthropicApiService],
      // 新しいAPIサービスはここに追加
    ]);
  }

  async create(providerName: string): Promise<Api> {
    const ApiService = this.apiMap.get(providerName);
    if (ApiService) {
      return new ApiService();
    }
    throw new Error(`Unsupported provider: ${providerName}`);
  }
}
