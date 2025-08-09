import { z } from 'zod';
import { FrameworkSchema } from './schema';
import { FrameworkDslV1 } from './v1';

// Framework DSL v2
// クラスにSchema/parseを集約し、他所からは FrameworkDslV2.Schema / FrameworkDslV2.parse を利用
export class FrameworkDslV2 {
  static Version = 2 as const;
  static Schema = z.object({
    version: z.literal(2),
    id: z.string().uuid(),
    slug: z.string().min(1).optional(),
    name: z.string().min(1),
    content: z.string().default(''),
    metadata: z.record(z.unknown()).optional(),
  }).strict();

  static parse(input: unknown): z.infer<typeof FrameworkDslV2.Schema> {
    let obj = input as FrameworkSchema;
    // v1はversionプロパティを持たない可能性があるため、存在チェックも行う
    const version = obj.version ?? 1;

    if (version === 1) {
      obj = {
        ...FrameworkDslV1.parse(input),
        version: 2,
      };
    } else if (version !== FrameworkDslV2.Version) {
      throw new Error(`Unsupported framework version: ${version}`);
    }

    return FrameworkDslV2.Schema.parse(obj);
  }
}

// 型はクラスとマージ（クラス名を型注釈にも使えるようにする）
export interface FrameworkDslV2 extends z.infer<typeof FrameworkDslV2.Schema> {}
