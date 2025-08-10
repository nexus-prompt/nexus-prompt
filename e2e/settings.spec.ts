import { test, expect } from './fixtures';
import type { AppData } from '../src/types';
import { STORAGE_KEY } from '../src/services/storage';
import { GeminiApiServiceName } from '../src/services/gemini-api';
import { OpenAIApiServiceName } from '../src/services/openai-api';
import { AnthropicApiServiceName } from '../src/services/anthropic-api';

const TEST_API_KEY_NEW = 'TEST_API_KEY_NEW';

test.describe('APIキー設定画面', () => {
  test.beforeEach(async ({ serviceWorker }) => {
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.clear();
      await (self as any)._test_initialize();
    });
  });

  test('Happy Path: APIキーの表示と更新ができること', async ({ context, serviceWorker, extensionUrl }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("設定")');

    await page.fill('[data-testid="gemini-api-key-input"]', TEST_API_KEY_NEW);
    await page.click('[data-testid="save-gemini-api-key-button"]');
    
    await expect(page.locator('[data-testid="message-area"]')).toHaveText('APIキーを保存しました');
    const storedData = await serviceWorker.evaluate(async (key) => await chrome.storage.local.get(key), STORAGE_KEY);
    const appData: AppData = storedData[STORAGE_KEY];

    const geminiProvider = appData.providers.find(p => p.name === GeminiApiServiceName);
    expect(geminiProvider).toBeDefined();
    const openaiProvider = appData.providers.find(p => p.name === OpenAIApiServiceName);
    expect(openaiProvider).toBeDefined();
    const anthropicProvider = appData.providers.find(p => p.name === AnthropicApiServiceName);
    expect(anthropicProvider).toBeDefined();
  });

  test('Sad Path: 空のAPIキー保存時のバリデーションエラーが表示されること', async ({ context, serviceWorker, extensionUrl }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("設定")');

    const beforeData = await serviceWorker.evaluate(async (key) => await chrome.storage.local.get(key), STORAGE_KEY);

    await page.fill('[data-testid="gemini-api-key-input"]', '');
    await page.click('[data-testid="save-gemini-api-key-button"]');

    await expect(page.locator('[data-testid="message-area"]')).toHaveText('APIキーを入力してください');
    const afterData = await serviceWorker.evaluate(async (key) => await chrome.storage.local.get(key), STORAGE_KEY);
    expect(afterData).toEqual(beforeData);
  });
});

test.describe('インポート・エクスポート機能', () => {
  const testAppDataWithFrameworks: AppData = {
    prompts: [],
    providers: [
      {
        id: 'provider-gemini',
        name: 'Gemini',
        displayName: 'Google Gemini',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        models: [
          {
            id: 'model-gemini',
            name: 'gemini-2.0-flash',
            order: 1,
            enabled: true,
            isBuiltIn: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        ]
      }
    ],
    frameworks: [
      {
        id: 'framework-1',
        content: {
          version: 2,
          id: 'framework-1',
          name: 'テストフレームワーク',
          content: 'テスト用フレームワーク内容',
          slug: 'test-framework',
        },
        order: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
    ],
    settings: {
      defaultFrameworkId: 'framework-1',
      version: '1.0.2'
    }
  };

  test.beforeEach(async ({ serviceWorker }) => {
    await serviceWorker.evaluate(async () => {
      await chrome.storage.local.clear();
      await (self as any)._test_initialize();
    });

    await serviceWorker.evaluate(async (data: { AppData: AppData, key: string }) => {
      await chrome.storage.local.set({ [data.key]: data.AppData });
    }, {AppData: testAppDataWithFrameworks, key: STORAGE_KEY});
  });

  test('Happy Path: エクスポート機能が正常に動作すること', async ({ context, serviceWorker, extensionUrl }) => {
    const page = await context.newPage();

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("設定")');

    const downloadPromise = page.waitForEvent('download');

    await page.click('[data-testid="export-button"]');

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/nexus-prompt-frameworks-\d{4}-\d{2}-\d{2}\.json/);

    await expect(page.locator('[data-testid="message-area"]')).toHaveText('フレームワークデータをエクスポートしました');

    await page.close();
  });

  test('Happy Path: インポート機能が正常に動作すること', async ({ context, serviceWorker, extensionUrl }) => {
    const page = await context.newPage();

    page.on('dialog', dialog => dialog.accept());

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("設定")');

    const importData = {
      prompts: [],
      frameworks: [
        {
          id: 'framework-imported',
          name: 'インポートされたフレームワーク',
          content: {
            version: 2,
            id: 'framework-imported',
            name: 'インポートされたフレームワーク',
            content: 'インポート用フレームワーク内容',
            slug: 'test-framework',
          },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: 1
        }
      ]
    };

    const fileContent = JSON.stringify(importData);
    await page.setInputFiles('[data-testid="import-file-input"]', {
      name: 'test-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent)
    });

    await expect(page.locator('[data-testid="message-area"]')).toHaveText('フレームワークデータをインポートしました');

    const storedData = await serviceWorker.evaluate(async (key) => await chrome.storage.local.get(key), STORAGE_KEY);
    const appData: AppData = storedData[STORAGE_KEY];
    expect(appData.frameworks).toHaveLength(1);
    expect(appData.frameworks[0].content.name).toBe('インポートされたフレームワーク');

    await page.close();
  });

  test('Sad Path: 無効なJSONファイルインポート時のエラーハンドリング', async ({ context, serviceWorker, extensionUrl }) => {
    const page = await context.newPage();

    page.on('dialog', dialog => dialog.accept());

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("設定")');

    const invalidFileContent = '{ invalid json content }';
    await page.setInputFiles('[data-testid="import-file-input"]', {
      name: 'invalid-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(invalidFileContent)
    });

    await expect(page.locator('[data-testid="message-area"]')).toContainText('インポートファイルの形式が正しくありません。');

    const storedData = await serviceWorker.evaluate(async (key) => await chrome.storage.local.get(key), STORAGE_KEY);
    const appData: AppData = storedData[STORAGE_KEY];
    expect(appData.frameworks[0].content.name).toBe('テストフレームワーク');

    await page.close();
  });

  test('Sad Path: インポート確認ダイアログでキャンセルを選択', async ({ context, serviceWorker, extensionUrl }) => {
    const page = await context.newPage();

    page.on('dialog', dialog => dialog.dismiss());

    await page.goto(extensionUrl('popup.html'));
    await page.waitForSelector('[data-testid="nexus-prompt"]');
    await page.click('button:has-text("設定")');

    const importData = {
      frameworks: [
        {
          id: 'framework-cancelled',
          name: 'キャンセルされたフレームワーク',
          content: 'キャンセル用フレームワーク内容',
          prompts: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          order: 1
        }
      ]
    };

    const fileContent = JSON.stringify(importData);
    await page.setInputFiles('[data-testid="import-file-input"]', {
      name: 'cancelled-import.json',
      mimeType: 'application/json',
      buffer: Buffer.from(fileContent)
    });

    const storedData = await serviceWorker.evaluate(async (key) => await chrome.storage.local.get(key), STORAGE_KEY);
    const appData: AppData = storedData[STORAGE_KEY];
    expect(appData.frameworks[0].content.name).toBe('テストフレームワーク');

    await page.close();
  });
});