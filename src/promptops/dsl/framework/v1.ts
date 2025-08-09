import { z } from 'zod';
import type { FrameworkSchema } from './schema';

// Framework DSL v1
export class FrameworkDslV1 {
  static Version = 1 as const;

  static Schema = z.object({
    version: z.literal(1),
    id: z.string().uuid(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    content: z.string().default(''),
    metadata: z.record(z.unknown()).optional(),
  }).strict();

  static parse(input: unknown): z.infer<typeof FrameworkDslV1.Schema> {
    let obj = input as FrameworkSchema;

    if (obj.version === undefined) {
      obj = { ...obj, version: 1 };
    }

    if (obj.version !== this.Version) {
      throw new Error(`FrameworkDslV1: Unsupported version: ${obj.version}. Only version 1 is supported.`);
    }

    return FrameworkDslV1.Schema.parse(obj);
  }
}

export interface FrameworkDslV1 extends z.infer<typeof FrameworkDslV1.Schema> {}
