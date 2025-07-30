import type { Api } from '../types';
import { PromptBuilder } from './prompt-builder';

export abstract class BaseApiService implements Api {
  /**
   * プロンプトを改善する共通ロジック
   */
  async improvePrompt(
    userPrompt: string,
    selectedPrompt: string,
    frameworkContent: string,
    apiKey: string,
    modelName: string
  ): Promise<string> {
    const promptBuilder = new PromptBuilder(selectedPrompt, userPrompt, frameworkContent);
    const fullPrompt = promptBuilder.build();

    return await this.generateContent(fullPrompt, apiKey, modelName);
  }

  /**
   * 各APIサービス固有のコンテンツ生成ロジック。サブクラスで必ず実装する必要があります。
   */
  abstract generateContent(prompt: string, apiKey: string, modelName: string): Promise<string>;
}
