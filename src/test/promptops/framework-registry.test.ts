import { describe, it, expect } from 'vitest';
import { parseFramework, dumpFramework, getLatestFrameworkVersion } from '../../promptops/dsl/framework/registry';

describe('framework registry', () => {
  it('YAML/JSON文字列/オブジェクトの入力を受け取ってv2に正規化して返す', () => {
    const obj = parseFramework({ version: 2, id: '11111111-1111-1111-8111-111111111111', name: 'f', content: 'c' });
    expect(obj.version).toBe(2);
    expect(obj.name).toBe('f');
    const yaml = dumpFramework(obj);
    expect(typeof yaml).toBe('string');
    expect(getLatestFrameworkVersion()).toBe(2);
  });

  it('v1相当の入力をv2へマイグレートする', () => {
    const parsed = parseFramework({ id: '11111111-1111-1111-8111-111111111111', name: 'f', content: 'c' });
    expect(parsed.version).toBe(2);
    expect(parsed.content).toBe('c');
  });
});
