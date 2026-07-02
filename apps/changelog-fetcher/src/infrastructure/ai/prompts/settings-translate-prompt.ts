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
  schema_default?: string;
  schema_enum?: string[];
};

function buildSchemaText(
  schema_default: string | undefined,
  schema_enum: string[] | undefined,
): string {
  const parts: string[] = [];
  if (schema_default !== undefined) {
    parts.push(`デフォルト値: ${JSON.stringify(schema_default)}`);
  }
  if (schema_enum !== undefined && schema_enum.length > 0) {
    parts.push(
      `選択肢: [${schema_enum.map((v) => JSON.stringify(v)).join(', ')}]`,
    );
  }
  return parts.length > 0
    ? ['### スキーマ情報', `- ${parts.join(', ')}`].join('\n')
    : '';
}

/**
 * 設定・環境変数の翻訳と用途解説プロンプトを構築
 *
 * 入力: 設定エントリ一覧(docs スニペット・更新履歴を含む)
 * 出力: description_ja(翻訳) / use_case_ja(用途解説、コンテキストがある場合のみ)
 */
export function buildSettingsTranslatePrompt(
  entries: SettingEntryForPrompt[],
  modelContext: string,
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
        schema_default,
        schema_enum,
      }) => {
        const sourceLabel =
          source === 'settings' ? 'settings.json 設定' : '環境変数';
        const parentText =
          parent_descriptions.length > 0
            ? [
                '### 親オブジェクトの説明',
                parent_descriptions
                  .map((description) => ['- ', description].join(''))
                  .join('\n'),
              ].join('\n')
            : '';
        const docsText =
          doc_snippets.length > 0
            ? ['### 関連ドキュメント', doc_snippets.join('\n\n')].join('\n')
            : '';
        const changelogText =
          related_changelog.length > 0
            ? [
                '### 関連更新履歴',
                related_changelog
                  .map((c) => {
                    const lines: string[] = [];
                    if (c.content_ja) {
                      lines.push(['- ', c.content_ja].join(''));
                    }
                    if (c.inference) {
                      lines.push(['  変更前: ', c.inference.before].join(''));
                      lines.push(['  変更後: ', c.inference.after].join(''));
                      lines.push(['  恩恵: ', c.inference.benefit].join(''));
                    }
                    return lines.join('\n');
                  })
                  .join('\n'),
              ].join('\n')
            : '';
        const schemaText = buildSchemaText(schema_default, schema_enum);

        return [
          ['#### エントリ id=', id, ' (', sourceLabel, ')'].join(''),
          ['- キー: `', key, '`'].join(''),
          ['- 英語説明: ', description_en].join(''),
          parentText,
          schemaText,
          docsText,
          changelogText,
        ]
          .filter((line) => line.length > 0)
          .join('\n')
          .trim();
      },
    )
    .join('\n\n');

  const translationSection = withoutContext
    .map(({ id, key, source, description_en, schema_default, schema_enum }) => {
      const sourceLabel =
        source === 'settings' ? 'settings.json 設定' : '環境変数';
      const schemaText = buildSchemaText(schema_default, schema_enum);
      return [
        ['#### エントリ id=', id, ' (', sourceLabel, ')'].join(''),
        ['- キー: `', key, '`'].join(''),
        ['- 英語説明: ', description_en].join(''),
        schemaText,
      ]
        .filter((line) => line.length > 0)
        .join('\n');
    })
    .join('\n\n');

  return [
    '# 思考のレンズ',
    '',
    '## 前提 (Premise)',
    '- Claude Code は開発者向けの AI アシスタント CLI ツールである',
    '- ユーザーは設定名・環境変数名で検索して来訪し、「この設定は何をするのか・いつ使うのか」を知りたい',
    '- 用途解説は単なる翻訳ではなく、具体的な使いどころや課題解決の観点で書く',
    '- デフォルト値・有効化/無効化の条件・取りうる値はユーザーが即座に活用するための重要な情報',
    '- ドキュメント・スキーマ・英語説明に記載のない内容は絶対に書かない',
    '',
    '## Claude Code のモデル情報 (重要)',
    modelContext,
    '',
    '## 動機 (Motive)',
    '設定のデフォルト値や選択肢はスキーマから取得できるが、「なぜその値を変えるのか」「どんな状況で有効化するのか」はドキュメントや更新履歴にしか載っていない。両者を組み合わせてユーザーが即座に使える情報を提供する。',
    '',
    '## 状況 (Situation)',
    ['Claude Code の設定・環境変数 ', entries.length, ' 件を処理する。'].join(
      '',
    ),
    '',
    '## 目的 (Purpose)',
    '以下の2つのタスクを実行する:',
    '1. **翻訳+用途解説** (コンテキストあり): 関連ドキュメントまたは更新履歴がある設定について、翻訳 + 用途解説を生成',
    '2. **翻訳+操作情報** (コンテキストなし): 参照情報がない設定について、日本語翻訳 + スキーマ情報から読み取れる操作情報を生成',
    '',
    '---',
    '',
    '# タスク1: 翻訳+用途解説 (コンテキストあり)',
    '',
    '以下の各エントリについて、description_ja と use_case_ja を生成する。',
    '',
    '## 制約',
    '- description_ja: 英語説明を技術的に正確かつ自然な日本語に翻訳する(1文)',
    '- use_case_ja: 関連ドキュメントと更新履歴を参照し、「何をする設定か・どんな課題を解決するか」を 2〜3 行の箇条書きで表現する',
    '  - デフォルト値・有効化条件・選択肢が分かる場合はそれも含める',
    '  - 固定フォーマットは不要。AI が重要な情報を選んで箇条書きにする',
    '  - ドキュメントや更新履歴に記載がない内容は書かない',
    '  - 箇条書きは「- 」で始める',
    '- id は入力値をそのまま返すこと',
    '- use_case_ja が空文字の場合、コンテキストなしとして扱う',
    '',
    '## 対象エントリ',
    '',
    contextSection || '(対象なし)',
    '',
    '---',
    '',
    '# タスク2: 翻訳+操作情報 (コンテキストなし)',
    '',
    '以下の各エントリについて、description_ja を生成する。スキーマ情報(デフォルト値・選択肢)がある場合は use_case_ja も生成する。',
    '',
    '## 制約',
    '- description_ja: 英語説明を技術的に正確かつ自然な日本語に翻訳する(1文)',
    '- 開発者向けの自然な日本語表現を心がける',
    '- use_case_ja: スキーマ情報から読み取れるデフォルト値・選択肢を箇条書きで表現する。スキーマ情報がない場合は空文字で返す',
    '  - description_en・スキーマに記載のない内容は書かない',
    '  - 箇条書きは「- 」で始める',
    '- id は入力値をそのまま返すこと',
    '',
    '## 対象エントリ',
    '',
    translationSection || '(対象なし)',
  ]
    .join('\n')
    .trim();
}
