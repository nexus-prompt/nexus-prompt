import type { LatestFrameworkDsl } from './registry';
import { parseFramework } from './registry';
import { FrameworkDslV2 } from './v2';

export interface FrameworkViewModel {
  id: string;
  name: string;
  slug?: string;
  content: string;
  metadata?: LatestFrameworkDsl['metadata'];
}

/**
 * Framework DSL を UI 向けのレンダリング・ビューに変換する純関数
 * - 入力は文字列（YAML/JSON）または既にパース済みオブジェクト
 * - 検証は parseFramework に委譲
 */
export function createFrameworkViewModel(input: string | unknown): FrameworkViewModel {
  const fw = parseFramework(input);
  return {
    id: fw.id,
    name: fw.name,
    slug: fw.slug,
    content: fw.content,
    metadata: fw.metadata,
  };
}

/**
 * UIのFrameworkViewModelからDSL（LatestFrameworkDsl）を組み立てる
 * - スキーマで最終検証して返す
 */
export function toFrameworkDsl(view: FrameworkViewModel): LatestFrameworkDsl {
  const candidate: LatestFrameworkDsl = {
    version: FrameworkDslV2.Version,
    id: view.id,
    name: view.name,
    slug: view.slug,
    content: view.content,
    metadata: view.metadata,
  } as LatestFrameworkDsl;

  return FrameworkDslV2.Schema.parse(candidate);
}
