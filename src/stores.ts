import { writable, type Writable } from 'svelte/store';
import type { AppData, SnapshotData } from './types';
import { storageService } from './services/storage';

/**
 * ストレージと同期するカスタムストアのインターフェース。
 * Writable に加え、ストレージへの再書き込みをバイパスするメソッドを持ちます。
 */
export interface SyncedStore<T> extends Writable<T> {
  setFromStorage: (value: T) => void;
}

/**
 * chrome.storage.local と自動的に同期するカスタムストアを作成します。
 * @param initialValue 初期値
 * @param storageSaver ストレージに保存するための関数
 */
function createSyncedStore<T>(initialValue: T, storageSaver: (data: T) => Promise<void>): SyncedStore<T> {
  const { subscribe, set: baseSet } = writable<T>(initialValue);

  let currentValue: T = initialValue;
  subscribe((v) => { currentValue = v; });

  let isApplyingFromStorage = false;

  const set = (value: T) => {
    baseSet(value);
    if (!isApplyingFromStorage) {
      void storageSaver(value);
    }
  };

  const update = (updater: (value: T) => T) => {
    const next = updater(currentValue);
    set(next);
  };

  const setFromStorage = (value: T) => {
    isApplyingFromStorage = true;
    baseSet(value);
    isApplyingFromStorage = false;
  };

  return { subscribe, set, update, setFromStorage };
}

// 変更があると自動で chrome.storage.local に保存される
export const appData = createSyncedStore<AppData | null>( 
  null,
  async (data) => { if (data) await storageService.saveAppData(data); }
);

export const snapshotData = createSyncedStore<SnapshotData | null>( 
  null,
  async (data) => { if (data) await storageService.saveSnapshot(data); }
);

export async function initializeStores(): Promise<void> {
  try {
    const data = await storageService.getAppData();
    appData.setFromStorage(data);
  } catch (e) {
    console.warn('AppDataが未初期化のため初期化します:', e);
    await storageService.initializeAppData();
    appData.setFromStorage(await storageService.getAppData());
  }

  snapshotData.setFromStorage(await storageService.getSnapshot());
}

