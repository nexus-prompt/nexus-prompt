import type { ProvidersData } from "./types";

export const providersData: ProvidersData = {
  providers: [
    {
      name: "Gemini",
      displayName: "Google Gemini",
      models: [
        { name: "gemini-2.0-flash" },
        { name: "gemini-2.5-flash" },
        { name: "gemini-2.5-pro" },
      ]
    },
    {
      name: "OpenAI",
      displayName: "OpenAI",
      models: [
        { name: "gpt-4.1-2025-04-14" },
        { name: "gpt-4.1-mini-2025-04-14" },
        { name: "gpt-4.1-nano-2025-04-14" },
        { name: "o4-mini-2025-04-16" },
      ]
    },
    {
      name: "Anthropic",
      displayName: "Anthropic",
      models: [
        { name: "claude-3-5-haiku-latest" },
        { name: "claude-3-5-sonnet-latest" },
      ]
    },
  ]
}; 
