import { AppData, Prompt } from '../src/types';
import { test, expect } from './fixtures';
import { STORAGE_KEY } from '../src/services/storage';

test.describe('プロンプトテンプレート管理テスト', () => {
  let initialData: AppData = {
    providers: [
      {
        id: 'gemini-provider-id', 
        name: 'Gemini',
        displayName: 'Google Gemini',
        models: [{ id: 'gemini-model-id', name: 'gemini-2.0-flash', order: 1, enabled: true, isBuiltIn: true, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }],
        createdAt: new Date().toISOString(), 
        updatedAt: new Date().toISOString()
      }
    ],
    frameworks: [
      {
        id: 'test-framework-id',
        name: 'テストフレームワーク',
        content: 'テストコンテンツ',
        order: 1,
        prompts: [
          { id: 'prompt-1', name: '既存のプロンプト1', content: '内容1', order: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
          { id: 'prompt-2', name: '既存のプロンプト2', content: '内容2', order: 2, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    settings: { defaultFrameworkId: 'test-framework-id', version: '1.0.0' }
  };

  test.beforeEach(async ({ serviceWorker }) => {
    await serviceWorker.evaluate(async (data: { AppData: AppData, key: string }) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set({ [data.key]: data.AppData });
    }, {AppData: initialData, key: STORAGE_KEY});
  });

  test('Happy Path: プロンプトテンプレートの作成', async ({ context, extensionUrl, serviceWorker }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("LLMプロンプト管理")');
    
    await page.click('[data-testid="new-prompt-button"]');
    await expect(page.locator('[data-testid="prompt-modal"]')).toBeVisible();

    const newPromptName = '新しいテストプロンプト';
    const newPromptContent = 'これは新しいプロンプトのテスト内容です。';
    await page.fill('[data-testid="prompt-name-input"]', newPromptName);
    await page.fill('[data-testid="prompt-content-input"]', newPromptContent);
    await page.click('[data-testid="save-prompt-button"]');

    await expect(page.locator('[data-testid="message-area"]')).toContainText('プロンプトを保存しました');
    await expect(page.locator('[data-testid="prompt-modal"]')).not.toBeVisible();

    const storedData = await serviceWorker.evaluate(async (key: string) => {
      return await chrome.storage.local.get(key);
    }, STORAGE_KEY);
    const prompts = storedData[STORAGE_KEY].frameworks[0].prompts;
    expect(prompts.length).toBe(3);
    const newPrompt = prompts.find((p: Prompt) => p.name === newPromptName);
    expect(newPrompt).toBeDefined();
    expect(newPrompt.content).toBe(newPromptContent);

    await expect(page.locator('[data-testid="prompt-list"]')).toContainText(newPromptName);
  });

  test('Happy Path: プロンプトテンプレートの編集', async ({ context, extensionUrl, serviceWorker }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("LLMプロンプト管理")');

    await page.locator('.prompt-item:has-text("既存のプロンプト1")').locator('button:has-text("編集")').click();
    
    await expect(page.locator('[data-testid="prompt-modal"]')).toBeVisible();
    const updatedPromptName = '更新されたプロンプト';
    const updatedPromptContent = '更新された内容です。';
    await page.fill('[data-testid="prompt-name-input"]', updatedPromptName);
    await page.fill('[data-testid="prompt-content-input"]', updatedPromptContent);
    await page.click('[data-testid="save-prompt-button"]');

    await expect(page.locator('[data-testid="message-area"]')).toContainText('プロンプトを保存しました');
    
    const storedData = await serviceWorker.evaluate(async (key: string) => {
      return await chrome.storage.local.get(key);
    }, STORAGE_KEY);
    const prompts = storedData[STORAGE_KEY].frameworks[0].prompts;
    const updatedPrompt = prompts.find((p: Prompt) => p.id === 'prompt-1');
    expect(updatedPrompt?.name).toBe(updatedPromptName);
    expect(updatedPrompt?.content).toBe(updatedPromptContent);

    await expect(page.locator('[data-testid="prompt-list"]')).toContainText(updatedPromptName);
    await expect(page.locator('[data-testid="prompt-list"]')).not.toContainText('既存のプロンプト1');
  });

  test('Happy Path: プロンプトテンプレートの削除', async ({ context, extensionUrl, serviceWorker }) => {
    const page = await context.newPage();

    page.on('dialog', dialog => dialog.accept());
    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("LLMプロンプト管理")');

    await page.locator('.prompt-item:has-text("既存のプロンプト1")').locator('button:has-text("削除")').click();
    
    await expect(page.locator('[data-testid="message-area"]')).toContainText('プロンプトを削除しました');

    const storedData = await serviceWorker.evaluate((key: string) => {
      return chrome.storage.local.get(key);
    }, STORAGE_KEY);
    const prompts = storedData[STORAGE_KEY].frameworks[0].prompts;
    expect(prompts.length).toBe(1);
    expect(prompts.find((p: Prompt) => p.id === 'prompt-1')).toBeUndefined();

    await expect(page.locator('[data-testid="prompt-list"]')).not.toContainText('既存のプロンプト1');
    await expect(page.locator('[data-testid="prompt-list"]')).toContainText('既存のプロンプト2');
  });

  test('Sad Path: プロンプト内容が空での保存', async ({ context, extensionUrl, serviceWorker }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("LLMプロンプト管理")');

    await page.click('[data-testid="new-prompt-button"]');

    await page.fill('[data-testid="prompt-name-input"]', 'タイトルのみ');
    await page.fill('[data-testid="prompt-content-input"]', '   ');
    await page.click('[data-testid="save-prompt-button"]');

    await expect(page.locator('[data-testid="message-area"]')).toContainText('プロンプト内容を入力してください');
    await expect(page.locator('[data-testid="prompt-modal"]')).toBeVisible();

    const storedData = await serviceWorker.evaluate(async (key: string) => {
      return await chrome.storage.local.get(key);
    }, STORAGE_KEY);
    const prompts = storedData[STORAGE_KEY].frameworks[0].prompts;
    expect(prompts.length).toBe(2);
  });

  test('Edge Case: タイトルが空でもデフォルト値で保存される', async ({ context, extensionUrl, serviceWorker }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("LLMプロンプト管理")');

    await page.click('[data-testid="new-prompt-button"]');

    await page.fill('[data-testid="prompt-content-input"]', '内容があればOK');
    await page.click('[data-testid="save-prompt-button"]');

    await expect(page.locator('[data-testid="message-area"]')).toContainText('プロンプトを保存しました');

    const storedData = await serviceWorker.evaluate(async (key: string) => {
      return await chrome.storage.local.get(key);
    }, STORAGE_KEY);
    const prompts = storedData[STORAGE_KEY].frameworks[0].prompts;
    expect(prompts.length).toBe(3);
    const newPrompt = prompts.find((p: Prompt) => p.content === '内容があればOK');
    expect(newPrompt?.name).toBe('プロンプト');

    await expect(page.locator('[data-testid="prompt-list"]')).toContainText("内容があればOK");
  });
}); 