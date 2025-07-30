/**
 * APIキーが無効であるなど、認証に関するエラーを表すカスタムエラー。
 * このエラーをキャッチすることで、UI側でAPIキー関連のエラーとして特別な処理を行うことができます。
 */
export class ApiKeyAuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyAuthenticationError';
  }
}
