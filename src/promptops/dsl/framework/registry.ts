import { z } from 'zod';
import { FrameworkDslV2 } from './v2';
import { dumpYamlStable, loadYaml } from '../serializer';

export type LatestFrameworkDsl = z.infer<typeof FrameworkDslV2.Schema>;

// 入力はYAML, JSON, TOML文字列または既にパース済みオブジェクトの両対応
export function parseFramework(input: string| unknown): LatestFrameworkDsl {
  const obj = typeof input === 'string' ? loadYaml(input) : input;
  return FrameworkDslV2.parse(obj);
}

export function dumpFramework(framework: LatestFrameworkDsl): string {
  return dumpYamlStable(framework);
}

export function getLatestFrameworkVersion(): number {
  return FrameworkDslV2.Version;
}