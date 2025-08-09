import { z } from 'zod';
import type { PromptSchema } from './schema';

// Prompt DSL v1 クラス化（v2と同様のインターフェイス: Version/Schema/parse）
export class PromptDslV1 {
  static Version = 1 as const;

  static Model = z.object({
    provider: z.string().min(1),
    name: z.string().min(1),
  }).strict();

  static Variable = z.object({
    name: z.string().min(1),
    required: z.boolean().optional().default(false),
    description: z.string().optional(),
    default: z.string().optional(),
  }).strict();

  static Schema = z.object({
    version: z.literal(1),
    id: z.string().uuid(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    template: z.string().min(1),
    variables: z.array(PromptDslV1.Variable).optional().default([]),
    model: PromptDslV1.Model.optional(),
    metadata: z.record(z.unknown()).optional(),
    frameworkRef: z.string().optional(),
  }).strict();

    // 入力はYAML, JSON, TOML文字列または既にパース済みオブジェクトの両対応
  static parse(input: unknown) {
    let obj = input as PromptSchema;
    // v1の初期データはversionプロパティを持たない可能性があるため、存在しない場合はv1として扱う
    if (obj.version === undefined) {
      obj = { ...obj, version: PromptDslV1.Version };
    }

    if (obj.version !== PromptDslV1.Version) {
      throw new Error(`PromptDslV1: Unsupported version: ${obj.version}. Only version 1 is supported.`);
    }
    return PromptDslV1.Schema.parse(obj);
  }
}

export interface PromptDslV1 extends z.infer<typeof PromptDslV1.Schema> {}