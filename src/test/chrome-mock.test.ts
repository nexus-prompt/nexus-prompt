import { describe, it, expect } from 'vitest';

describe('基本的なテスト', () => {
  it('テストが実行される', () => {
    expect(true).toBe(true);
  });

  it('Chrome API モックが利用可能', () => {
    expect(chrome).toBeDefined();
    expect(chrome.storage).toBeDefined();
    expect(chrome.storage.local).toBeDefined();
  });
}); 