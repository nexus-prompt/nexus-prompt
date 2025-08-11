import { describe, it, expect } from 'vitest';
import { createPromptViewModel, toPromptDsl } from '../../promptops/dsl/prompt/renderer';

describe('prompt renderer helpers', () => {
  it('ViewModelへ変換し、再度DSLへ戻してもスキーマ整合性が保たれる', () => {
    const vm = createPromptViewModel({ version: 2, id: '11111111-1111-1111-8111-111111111111', name: 'p', template: 't', inputs: [{ name: 'x', type: 'string', default: 'd' }] });
    expect(vm.id).toBe('11111111-1111-1111-8111-111111111111');
    const dsl = toPromptDsl(vm);
    expect(dsl.version).toBe(2);
    expect(dsl.template).toBe('t');
    expect(dsl.inputs?.[0]?.name).toBe('x');
  });
});
