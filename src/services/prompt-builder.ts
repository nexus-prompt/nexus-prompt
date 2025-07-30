export class PromptBuilder {
  private selectedPrompt: string;
  private userPrompt: string;
  private frameworkContent: string;

  constructor(selectedPrompt: string, userPrompt: string, frameworkContent: string) {
    this.selectedPrompt = selectedPrompt;
    this.userPrompt = userPrompt;
    this.frameworkContent = frameworkContent;
  }

  build(): string {
    return `# タスク
以下のLLMプロンプトの具体例を元に以下の改善したいプロンプトを修正反映してください。以下のフレームワーク情報の切り口が明確になるように修正反映を行なってください。

修正時の判断基準：
1. LLMプロンプトの具体例で記載されているフレームワークの切り口が改善したいプロンプトになかった場合、その切り口の部分に補足情報として記載してください
2. 補足する内容について以下の場合は、行頭に「# 要修正：」を付けて出力してください：
  - 改善したいプロンプトの質問者が通常アクセスできない環境・ツール・権限を前提とする場合
  - 改善したいプロンプトの文脈から大きく逸脱した想定や制約条件の場合
  - 一般的でない専門環境や特殊な前提条件を含む場合
  - 質問の規模感に対して過度に複雑または企業レベルの要件を想定している場合
3. 上記に該当しない場合のみ、本文に直接組み込んでください

返答する際は改善したプロンプトだけを返してください。返ってきたプロンプトをそのまま使いたいからです。

# LLMプロンプトの具体例
\`\`\`
${this.selectedPrompt}
\`\`\`

# 改善したいプロンプト
\`\`\`
${this.userPrompt}
\`\`\`

# フレームワーク情報
\`\`\`
${this.frameworkContent}
\`\`\`
`;
  }
} 