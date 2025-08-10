import { z } from 'zod';
import { Slug, type PromptSchema, EnumGroups, Labels, Test } from './schema';
import { PromptDslV1 } from './v1';

// Prompt DSL v2 クラス: Schema/parseを集約
export class PromptDslV2 {
  static Version = 2 as const;
  static Model = z.object({
    provider: z.string().min(1),
    name: z.string().min(1),
    params: z.record(z.unknown()).optional(),
  }).strict();

  static Input = z.object({
    name: z.string().min(1),
    type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
    required: z.boolean().optional().default(false),
    ref: z.string().optional(), // enumグループ名等に参照する場合
    description: z.string().optional(),
    default: z.unknown().optional(),
  }).strict();

  static Schema = z.object({
    version: z.literal(PromptDslV2.Version),
    id: z.string().uuid(),
    name: z.string().optional(),
    slug: Slug.optional(),
    template: z.string().min(1),
    inputs: z.array(PromptDslV2.Input).optional().default([]),
    model: PromptDslV2.Model.optional(),
    enums: EnumGroups.optional(),
    labels: Labels.optional(),
    metadata: z.record(z.unknown()).optional(),
    tests: z.array(Test).optional(),
    context: z.record(z.unknown()).optional(),
    policies: z.record(z.unknown()).optional(),
    frameworkRef: z.string().optional(),
  }).strip();

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
