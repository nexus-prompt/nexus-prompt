import type { LatestPromptDsl } from './registry';
import { parsePrompt } from './registry';
import { PromptDslV2 } from './v2';

export type PromptFieldType = 'string' | 'number' | 'boolean' | 'array' | 'object';

export interface PromptFieldView {
  name: string;
  type: PromptFieldType;
  required: boolean;
  description?: string;
  defaultValue?: unknown;
  ref?: string;
}

export interface PromptViewModel {
  id: string;
  name?: string;
  slug?: string;
  template: string;
  fields: PromptFieldView[];
  model?: LatestPromptDsl['model'];
  enums?: LatestPromptDsl['enums'];
  labels?: LatestPromptDsl['labels'];
  metadata?: LatestPromptDsl['metadata'];
  context?: LatestPromptDsl['context'];
  policies?: LatestPromptDsl['policies'];
  frameworkRef?: string;
}

/**
 * Prompt DSL を UI 向けのレンダリング・ビューに変換する純関数
 * - 入力は文字列（YAML/JSON）または既にパース済みオブジェクト
 * - 検証は parsePrompt に委譲
 */
export function createPromptViewModel(input: string | unknown): PromptViewModel {
  const prompt = parsePrompt(input);

  const fields: PromptFieldView[] = (prompt.inputs ?? []).map((inp) => ({
    name: inp.name,
    type: inp.type,
    required: Boolean(inp.required),
    description: inp.description,
    defaultValue: inp.default,
    ref: inp.ref,
  }));

  return {
    id: prompt.id,
    name: prompt.name,
    slug: prompt.slug,
    template: prompt.template,
    fields,
    model: prompt.model,
    enums: prompt.enums,
    labels: prompt.labels,
    metadata: prompt.metadata,
    context: prompt.context,
    policies: prompt.policies,
    frameworkRef: prompt.frameworkRef,
  };
}

/**
 * UIのPromptViewModelからDSL（LatestPromptDsl）を組み立てる
 * - スキーマで最終検証して返す
 */
export function toPromptDsl(view: PromptViewModel): LatestPromptDsl {
  const inputs: NonNullable<LatestPromptDsl['inputs']> = (view.fields ?? []).map((f) => ({
    name: f.name,
    type: f.type,
    required: Boolean(f.required),
    ref: f.ref,
    description: f.description,
    default: f.defaultValue,
  }));

  const candidate: LatestPromptDsl = {
    version: PromptDslV2.Version,
    id: view.id,
    name: view.name,
    slug: view.slug,
    template: view.template,
    inputs,
    model: view.model,
    enums: view.enums,
    labels: view.labels,
    metadata: view.metadata,
    context: view.context,
    policies: view.policies,
    frameworkRef: view.frameworkRef,
  } as LatestPromptDsl;

  return PromptDslV2.Schema.parse(candidate);
}


