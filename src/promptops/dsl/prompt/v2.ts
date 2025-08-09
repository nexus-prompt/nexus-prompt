import { z } from 'zod';
import type { PromptSchema } from './schema';
import { PromptDslV1 } from './v1';

// Prompt DSL v2 クラス: Schema/parseを集約
export class PromptDslV2 {
  static Version = 2 as const;
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
    version: z.literal(2),
    id: z.string().uuid(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    template: z.string().min(1),
    variables: z.array(PromptDslV2.Variable).optional().default([]),
    model: PromptDslV2.Model.optional(),
    metadata: z.record(z.unknown()).optional(),
    frameworkRef: z.string().optional(),
  }).strict();

  static parse(input: unknown) {
    let obj = input as PromptSchema;
   // v1はversionプロパティを持たない可能性があるため、存在チェックも行う
   const version = obj.version ?? 1;

    if (version === 1) {

      obj = {
        ...PromptDslV1.parse(input),
        version: 2,
      };
    } else if (version !== PromptDslV2.Version) {
      throw new Error(`Unsupported prompt version: ${version}`);
    }
    return PromptDslV2.Schema.parse(obj);
  }
}

export interface PromptDslV2 extends z.infer<typeof PromptDslV2.Schema> {}
