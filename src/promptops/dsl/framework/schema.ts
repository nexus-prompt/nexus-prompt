import { z } from 'zod';

export interface FrameworkSchema {
  version: number;
}
export const Slug = z.string().regex(/^[a-z0-9][a-z0-9_-]*$/);
