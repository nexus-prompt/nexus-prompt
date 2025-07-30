import {
  test as base,
  expect,
  chromium,
  type BrowserContext,
  type Page,
  type Worker as ServiceWorker
} from '@playwright/test';

import path from 'path';
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EXTENSION_PATH = path.join(__dirname, '../dist');

type ExtensionFixtures = {
  context: BrowserContext;
  serviceWorker: ServiceWorker;
  extensionId: string;
  extensionUrl: (path: string) => string;
};

export const test = base.extend<ExtensionFixtures>({
  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      // headless: false, // デバッグ中は headful モードが便利
      channel: 'chromium',
      args: [
        '--headless=new',
        `--disable-extensions-except=${EXTENSION_PATH}`,
        `--load-extension=${EXTENSION_PATH}`,
      ],
    });
    await use(context);
    await context.close();
  },
  serviceWorker: async ({ context }, use) => {
    let [background] = context.serviceWorkers();
    if (!background) {
      background = await context.waitForEvent('serviceworker');
    }
    await expect.poll(async () => {
      try {
        await background.evaluate(() => chrome.runtime.id);
        return true;
      } catch (error) {
        return false;
      }
    }, {
      message: 'Service Workerが時間内に利用可能になりませんでした。',
      timeout: 10000,
    }).toBe(true);
    await use(background);
  },
  extensionId: async ({ serviceWorker }, use) => {
    await use(serviceWorker.url().split('/')[2]);
  },
  extensionUrl: async ({ extensionId }, use) => {
    const buildUrl = (path: string) => `chrome-extension://${extensionId}/${path}`;
    await use(buildUrl);
  },
});

export { expect, type Page };