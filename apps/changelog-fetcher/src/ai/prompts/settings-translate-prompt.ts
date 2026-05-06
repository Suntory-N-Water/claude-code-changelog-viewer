export type SettingEntryForPrompt = {
  id: number;
  key: string;
  source: 'settings' | 'env';
  description_en: string;
  parent_descriptions: string[];
  doc_snippets: string[];
  related_changelog: {
    content_ja?: string;
    inference?: {
      before: string;
      after: string;
      benefit: string;
    };
  }[];
};

/**
 * 設定・環境変数の翻訳と用途解説プロンプトを構築
 *
 * 入力: 設定エントリ一覧(docs スニペット・更新履歴を含む)
 * 出力: description_ja(翻訳) / use_case_ja(用途解説、コンテキストがある場合のみ)
 */
export function buildSettingsTranslatePrompt(
  entries: SettingEntryForPrompt[],
): string {
  const withContext = entries.filter(
    (e) => e.doc_snippets.length > 0 || e.related_changelog.length > 0,
  );
  const withoutContext = entries.filter(
    (e) => e.doc_snippets.length === 0 && e.related_changelog.length === 0,
  );

  const contextSection = withContext
    .map(
      ({
        id,
        key,
        source,
        description_en,
        parent_descriptions,
        doc_snippets,
        related_changelog,
      }) => {
        const sourceLabel =
          source === 'settings' ? 'settings.json 設定' : '環境変数';
        const parentText =
          parent_descriptions.length > 0
            ? `### 親オブジェクトの説明\n${parent_descriptions.map((d) => `- ${d}`).join('\n')}`
            : '';
        const docsText =
          doc_snippets.length > 0
            ? `### 関連ドキュメント\n${doc_snippets.join('\n\n')}`
            : '';
        const changelogText =
          related_changelog.length > 0
            ? `### 関連更新履歴\n${related_changelog
                .map((c) => {
                  const lines: string[] = [];
                  if (c.content_ja) {
                    lines.push(`- ${c.content_ja}`);
                  }
                  if (c.inference) {
                    lines.push(`  変更前: ${c.inference.before}`);
                    lines.push(`  変更後: ${c.inference.after}`);
                    lines.push(`  恩恵: ${c.inference.benefit}`);
                  }
                  return lines.join('\n');
                })
                .join('\n')}`
            : '';

        return `#### エントリ id=${id} (${sourceLabel})
- キー: \`${key}\`
- 英語説明: ${description_en}
${parentText}
${docsText}
${changelogText}`.trim();
      },
    )
    .join('\n\n');

  const translationSection = withoutContext
    .map(({ id, key, source, description_en }) => {
      const sourceLabel =
        source === 'settings' ? 'settings.json 設定' : '環境変数';
      return `#### エントリ id=${id} (${sourceLabel})
- キー: \`${key}\`
- 英語説明: ${description_en}`;
    })
    .join('\n\n');

  return `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタント CLI ツールである
- ユーザーは設定名・環境変数名で検索して来訪し、「この設定は何をするのか・いつ使うのか」を知りたい
- 用途解説は単なる翻訳ではなく、具体的な使いどころや課題解決の観点で書く

## 状況 (Situation)
Claude Code の設定・環境変数 ${entries.length} 件を処理する。

## 目的 (Purpose)
以下の2つのタスクを実行する:
1. **翻訳+用途解説** (コンテキストあり): 関連ドキュメントまたは更新履歴がある設定について、翻訳 + 用途解説を生成
2. **翻訳のみ** (コンテキストなし): 参照情報がない設定について、日本語翻訳のみ生成

---

# タスク1: 翻訳+用途解説 (コンテキストあり)

以下の各エントリについて、description_ja と use_case_ja を生成する。

## 制約
- description_ja: 英語説明を技術的に正確かつ自然な日本語に翻訳する(1文)
- use_case_ja: 関連ドキュメントと更新履歴を参照し、「何をする設定か・どんな課題を解決するか」を 2〜3 行の箇条書きで表現する
  - 固定フォーマットは不要。AI が重要な情報を選んで箇条書きにする
  - ドキュメントや更新履歴に記載がない内容は書かない
  - 箇条書きは「- 」で始める
- id は入力値をそのまま返すこと
- use_case_ja が空文字の場合、コンテキストなしとして扱う

## 対象エントリ

${contextSection || '(対象なし)'}

---

# タスク2: 翻訳のみ (コンテキストなし)

以下の各エントリについて、description_ja のみを生成する。use_case_ja は空文字で返す。

## 制約
- description_ja: 英語説明を技術的に正確かつ自然な日本語に翻訳する(1文)
- 開発者向けの自然な日本語表現を心がける
- id は入力値をそのまま返すこと

## 対象エントリ

${translationSection || '(対象なし)'}
`.trim();
}
