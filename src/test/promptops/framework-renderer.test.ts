import { describe, it, expect } from 'vitest';
import { createFrameworkViewModel, toFrameworkDsl } from '../../promptops/dsl/framework/renderer';

describe('framework renderer helpers', () => {
  it('ViewModelへ変換し、再度DSLへ戻してもスキーマ整合性が保たれる', () => {
    const vm = createFrameworkViewModel({ version: 2, id: '11111111-1111-1111-8111-111111111111', name: 'f', content: 'c' });
    expect(vm.id).toBe('11111111-1111-1111-8111-111111111111');
    const dsl = toFrameworkDsl(vm);
    expect(dsl.version).toBe(2);
    expect(dsl.content).toBe('c');
  });
});
