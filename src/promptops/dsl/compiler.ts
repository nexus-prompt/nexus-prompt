import type { LatestPromptDsl } from './prompt/registry';

export interface CompileOptions {
  variables?: Record<string, string>;
}

export function compilePromptToString(
  prompt: LatestPromptDsl,
  options: CompileOptions = {}
): string {
  const baseTemplate = typeof prompt.template === 'string' ? prompt.template : String(prompt.template);
  return fillTemplateVariables(baseTemplate, prompt, options.variables);
}

function fillTemplateVariables(
  template: string,
  prompt: LatestPromptDsl,
  provided?: Record<string, string>
): string {
  if (!provided || Object.keys(provided).length === 0) return template;

  const defaults: Record<string, string> = {};
  if (Array.isArray((prompt as any).variables)) {
    for (const v of (prompt as any).variables as Array<{ name: string; default?: string }>) {
      if (v.name && typeof v.default === 'string') defaults[v.name] = v.default;
    }
  }

  const values = { ...defaults, ...provided } as Record<string, string>;
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_m, key: string) => {
    if (key in values) return values[key];
    return _m;
  });
}
