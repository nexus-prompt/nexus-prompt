import { z } from 'zod';

export interface PromptSchema {
  version: number;
}
export const Slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
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

