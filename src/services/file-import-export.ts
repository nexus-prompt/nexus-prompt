import type { AppData, Framework, Prompt } from '../types';
import { storageService, StorageService } from './storage';
import JSZip from 'jszip';
import { loadYaml, dumpYamlStable } from '../promptops/dsl/serializer';

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

    // ヘルパー: フロントマター+本文のMarkdownを生成（Buffer非依存）
    const buildFrontMatterMd = (body: string, data: Record<string, unknown>): string => {
      const yaml = dumpYamlStable(data);
      // yamlは末尾に改行が入るため、そのまま---と本文を接続
      return `---\n${yaml}---\n${body ?? ''}`;
    };

    for (const fw of appData.frameworks) {
      const content = fw.content; // LatestFrameworkDsl
      const fileName = `framework-${fw.id}.md`;
      const frontMatter: Record<string, unknown> = { ...(content as any) };
      const body = typeof (content as any).content === 'string'
        ? (content as any).content
        : String((content as any).content ?? '');
      delete (frontMatter as any).content;
      const markdown = buildFrontMatterMd(body, frontMatter);
      zip.file(fileName, markdown);
    }

    // Prompts をファイル化（YAMLフロントマターのみ、本文なし）: ルート直下に出力
    for (const p of appData.prompts) {
      const content = p.content; // LatestPromptDsl
      const fileName = `${p.id}.md`;
      const frontMatter: Record<string, unknown> = { ...(content as any) };
      const body = typeof (content as any).template === 'string'
        ? (content as any).template
        : String((content as any).template ?? '');
      delete (frontMatter as any).template;
      const markdown = buildFrontMatterMd(body, frontMatter);
      zip.file(fileName, markdown);
    }

    // ZIP を Uint8Array で返す
    const zipData = await zip.generateAsync({ type: 'uint8array' });
    return zipData;
  }

  /**
   * エクスポートフォーマットに合わせたインポート機能。
   * - ZIPバイト列（frameworks/*.md, prompts/*.md のフロントマターJSON）
   */
  async import(input: ArrayBuffer | Uint8Array): Promise<void> {
    // 入力はZIPバイト列（ArrayBuffer または Uint8Array）
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
    let zip: JSZip;
    try {
      zip = await JSZip.loadAsync(bytes);
    } catch (e) {
      throw new Error('インポートファイルの形式が正しくありません。');
    }

    const frameworks: Framework[] = [];
    const prompts: Prompt[] = [];

    const nowIso = new Date().toISOString();

    // フロントマター（YAML/JSON互換）+本文を抽出する軽量パーサ（ブラウザで Buffer を使わない）
    const parseFrontMatter = (markdown: string): { data: Record<string, unknown>; body: string } | null => {
      const lines = markdown.split(/\r?\n/);
      if (!lines[0] || !/^---(\w+)?\s*$/.test(lines[0])) {
        return null;
      }
      let closeIndex = -1;
      for (let i = 1; i < lines.length; i += 1) {
        if (/^---\s*$/.test(lines[i])) { closeIndex = i; break; }
      }
      if (closeIndex === -1) {
        return null;
      }
      const fmBody = lines.slice(1, closeIndex).join('\n').trim();
      const body = lines.slice(closeIndex + 1).join('\n').replace(/^\n+/, '');
      try {
        // YAMLはJSONのスーパーセットなので、YAMLローダで両方対応
        const data = loadYaml(fmBody) as Record<string, unknown>;
        return { data, body };
      } catch {
        return null;
      }
    };

    // ルート直下の framework-*.md を処理
    const fwFiles = Object.keys(zip.files).filter((p) => /^framework-.*\.md$/i.test(p));
    for (const path of fwFiles) {
      const file = zip.file(path);
      if (!file) continue;
      const markdown = await file.async('string');
        const parsed = parseFrontMatter(markdown);
        if (!parsed) continue;
        const data = parsed.data as unknown as Framework['content'];
        const dataWithContent = { ...(data as any), content: parsed.body } as Framework['content'];
      frameworks.push({
        id: (data as any).id,
        content: dataWithContent,
        order: frameworks.length + 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    // ルート直下の *.md のうち、framework- ではないものをすべて prompt として処理
    const prFiles = Object.keys(zip.files)
      .filter((p) => /\.md$/i.test(p))
      .filter((p) => !/^framework-.*\.md$/i.test(p));
    for (const path of prFiles) {
      const file = zip.file(path);
      if (!file) continue;
      const markdown = await file.async('string');
        const parsed = parseFrontMatter(markdown);
        if (!parsed) continue;
        const data = parsed.data as unknown as Prompt['content'];
        const dataWithTemplate = { ...(data as any), template: parsed.body } as Prompt['content'];
      prompts.push({
        id: (data as any).id,
        content: dataWithTemplate,
        order: prompts.length + 1,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    }

    const currentAppData = await this.storage.getAppData();
    const newAppData: AppData = {
      ...currentAppData,
      frameworks,
      prompts,
    };
    await this.storage.saveAppData(newAppData);

    const draft = await this.storage.getDraft();
    if (draft) {
      draft.selectedPromptId = '';
      await this.storage.saveDraft(draft);
    }
    return;
  }
}
