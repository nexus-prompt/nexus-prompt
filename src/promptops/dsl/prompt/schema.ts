import { z } from 'zod';
import { Slug, UuidV1toV6 } from '../schema-common';

export interface PromptSchema {
  version: number;
}
export const EnumGroups = z.record(z.array(z.string()));
export const Labels = z.record(z.record(z.string()));
export const Test = z.object({
  name: z.string().min(1),
  with: z.record(z.unknown()).default({}),
  assert: z.object({
    contains: z.array(z.string()).optional(),
    notContains: z.array(z.string()).optional(),
    maxTokens: z.number().int().positive().optional(),
  }).default({}),
}).strict();
export { Slug, UuidV1toV6 };
