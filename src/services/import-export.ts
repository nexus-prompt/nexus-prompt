import type { AppData, Framework } from '../types';
import { storageService, StorageService } from './storage';

export const ImportExportServiceName = 'ImportExportService';

// アプリケーションデータのインポート・エクスポートを管理するサービスクラス
export class ImportExportService {
  private storage: StorageService = storageService;

  /**
   * フレームワークデータをAppDataの形式を維持したJSON文字列としてエクスポートします。
   * providersとsettingsは個人情報や機密情報を含まないように空の状態でエクスポートされます。
   * @returns {Promise<string>} エクスポートされたAppData（frameworksのみを含む）のJSON文字列
   */
  async exportData(): Promise<string> {
    const appData = await this.storage.getAppData();

    appData.frameworks.forEach((framework) => {
      framework.id = '';
      framework.prompts.forEach((prompt) => {
        prompt.id = '';
      });
    });
    const dataToExport: AppData = {
      providers: [],
      frameworks: appData.frameworks,
      settings: {
        defaultFrameworkId: '',
        version: '',
      },
    };

    return JSON.stringify(dataToExport, null, 2);
  }

 /**
   * AppData形式のJSON文字列からフレームワークデータをインポートします。
   * JSON内のframeworksデータのみが使用され、既存のフレームワークデータは上書きされます。
   * providersやsettingsは現在の状態が維持されます。
   * @param {string} jsonString - インポートするAppData（frameworksを含む）のJSON文字列
   * @returns {Promise<void>}
   * @throws {Error} JSONのパースに失敗した場合や、データ形式が不正な場合にエラーをスローします
   */
  async importData(jsonString: string): Promise<void> {
    let parsedJson: unknown;

    try {
      parsedJson = JSON.parse(jsonString);
    } catch (error) {
      console.error('Failed to parse JSON for import:', error);
      throw new Error('インポートファイルの形式が正しくありません。');
    }

    // インポートデータのバリデーション
    // AppDataの構造を持っており、frameworksプロパティが配列であることを確認
    if (
      typeof parsedJson !== 'object' ||
      parsedJson === null ||
      !('frameworks' in parsedJson) ||
      !Array.isArray((parsedJson as { frameworks: unknown }).frameworks)
    ) {
      throw new Error('インポートデータはフレームワークの配列を含む正しい形式である必要があります。');
    }

    const importedFrameworks = (parsedJson as { frameworks: Framework[] }).frameworks;
    importedFrameworks.forEach((framework) => {
      framework.id = crypto.randomUUID();
      framework.createdAt = new Date().toISOString();
      framework.updatedAt = new Date().toISOString();
      framework.prompts.forEach((prompt) => {
        prompt.id = crypto.randomUUID();
        prompt.createdAt = new Date().toISOString();
        prompt.updatedAt = new Date().toISOString();
      });
    });
    const currentAppData = await this.storage.getAppData();

    const newAppData: AppData = {
      ...currentAppData,
      frameworks: importedFrameworks,
    };

    await this.storage.saveAppData(newAppData);

    const draft = await this.storage.getDraft();
    if (draft) {
      draft.selectedPromptId = '';
      await this.storage.saveDraft(draft);
    }
  }
}
