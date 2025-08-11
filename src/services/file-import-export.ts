import type { AppData, Framework, Prompt } from '../types';
import { storageService, StorageService } from './storage';
import matter from 'gray-matter';
import JSZip from 'jszip';

// アプリケーションデータのインポート・エクスポートを管理するサービスクラス
export class FileImportExportService {
  private storage: StorageService = storageService;

  /**
   * フレームワークデータをAppDataの形式を維持したJSON文字列としてエクスポートします。
   * providersとsettingsは個人情報や機密情報を含まないように空の状態でエクスポートされます。
   * @returns {Promise<string>} エクスポートされたAppData（frameworksのみを含む）のJSON文字列
   */
  async export(): Promise<Uint8Array> {
    const appData = await this.storage.getAppData();

    const zip = new JSZip();

    const frameworksFolder = zip.folder('frameworks');
    const promptsFolder = zip.folder('prompts');

    const toSafeKebab = (value: string) =>
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    // Frameworks をファイル化（JSONフロントマターのみ、本文なし）
    for (const fw of appData.frameworks) {
      const content = fw.content; // LatestFrameworkDsl
      const baseName =
        (typeof content.slug === 'string' && content.slug)
          || (typeof content.name === 'string' && content.name)
          || fw.id;
      const safe = toSafeKebab(baseName) || 'framework';
      const fileName = `${safe}-${fw.id}.md`;
      const markdown = matter.stringify(
        '',
        content as unknown as Record<string, unknown>,
        {
          language: 'json',
          engines: {
            json: {
              parse: JSON.parse,
              stringify: (data: unknown) => JSON.stringify(data, null, 2),
            },
          },
        }
      );
      frameworksFolder?.file(fileName, markdown);
    }

    // Prompts をファイル化（JSONフロントマターのみ、本文なし）
    for (const p of appData.prompts) {
      const content = p.content; // LatestPromptDsl
      const baseName =
        (typeof content.slug === 'string' && content.slug)
          || (typeof content.name === 'string' && content.name)
          || p.id;
      const safe = toSafeKebab(baseName) || 'prompt';
      const fileName = `${safe}-${p.id}.md`;
      const markdown = matter.stringify(
        '',
        content as unknown as Record<string, unknown>,
        {
          language: 'json',
          engines: {
            json: {
              parse: JSON.parse,
              stringify: (data: unknown) => JSON.stringify(data, null, 2),
            },
          },
        }
      );
      promptsFolder?.file(fileName, markdown);
    }

    // ZIP を Uint8Array で返す
    const zipData = await zip.generateAsync({ type: 'uint8array' });
    return zipData;
  }

 /**
   * AppData形式のJSON文字列からフレームワークデータをインポートします。
   * JSON内のframeworksデータのみが使用され、既存のフレームワークデータは上書きされます。
   * providersやsettingsは現在の状態が維持されます。
   * @param {string} jsonString - インポートするAppData（frameworksを含む）のJSON文字列
   * @returns {Promise<void>}
   * @throws {Error} JSONのパースに失敗した場合や、データ形式が不正な場合にエラーをスローします
   */
  async import(jsonString: string): Promise<void> {
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
      !('prompts' in parsedJson) ||
      !Array.isArray((parsedJson as { frameworks: unknown }).frameworks) ||
      !Array.isArray((parsedJson as { prompts: unknown }).prompts)
      ) {
      throw new Error('インポートデータはフレームワークの配列を含む正しい形式である必要があります。');
    }

    const importedFrameworks = (parsedJson as { frameworks: Framework[] }).frameworks;
    importedFrameworks.forEach((framework) => {
      framework.id = crypto.randomUUID();
      framework.createdAt = new Date().toISOString();
      framework.updatedAt = new Date().toISOString();
    });
    const importedPrompts = (parsedJson  as { prompts: Prompt[] }).prompts;
    importedPrompts.forEach((prompt) => {
      prompt.id = crypto.randomUUID();
      prompt.createdAt = new Date().toISOString();
      prompt.updatedAt = new Date().toISOString();
    });
    const currentAppData = await this.storage.getAppData();

    const newAppData: AppData = {
      ...currentAppData,
      frameworks: importedFrameworks,
      prompts: importedPrompts,
    };

    await this.storage.saveAppData(newAppData);

    const draft = await this.storage.getDraft();
    if (draft) {
      draft.selectedPromptId = '';
      await this.storage.saveDraft(draft);
    }
  }
}
