export interface Prompt {
  id: string;
  name: string;
  content: string;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface Framework {
  id: string;
  name: string;
  content: string;
  prompts: Prompt[];
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  order: number;
  enabled: boolean;
  isBuiltIn: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Provider {
  id: string;
  name: string;
  displayName: string;
  models: ModelInfo[];
  createdAt: string;
  updatedAt: string;
}

export interface Settings {
  defaultFrameworkId: string;
  version: string;
}

export interface AppData {
  providers: Provider[];
  frameworks: Framework[];
  settings: Settings;
}

export interface DraftData {
  userPrompt: string;
  selectedPromptId: string;
  resultArea: string;
  selectedModelId: string;
}

export interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

export interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

export interface AnthropicResponse {
  content: Array<{
    text: string;
  }>;
}

export interface Api {
  generateContent(prompt: string, apiKey: string, modelName: string): Promise<string>;
  improvePrompt(userPrompt: string, selectedPrompt: string, frameworkContent: string, apiKey: string, modelName: string): Promise<string>;
}

export type MessageType = 'success' | 'error' | 'info'; 
