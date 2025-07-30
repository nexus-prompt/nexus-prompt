// Chrome API Mock for development

// ローカルストレージを使ったモック実装
const mockStorage = {
  local: {
    get: async (keys: string[]): Promise<{ [key: string]: any }> => {
      const result: { [key: string]: any } = {};
      keys.forEach(key => {
        const value = localStorage.getItem(key);
        if (value) {
          result[key] = JSON.parse(value);
        }
      });
      return result;
    },
    set: async (items: { [key: string]: any }): Promise<void> => {
      Object.entries(items).forEach(([key, value]) => {
        localStorage.setItem(key, JSON.stringify(value));
      });
    }
  }
};

// Chrome APIが存在しない場合はモックを使用
if (typeof chrome === 'undefined' || !chrome.storage) {
  (window as any).chrome = {
    storage: mockStorage
  };
} 
