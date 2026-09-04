import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import type {
  SettingsReferenceAiPort,
  SettingsReferenceInput,
  SettingsReferenceInputEntry,
  SettingsReferenceTranslation,
} from '../../usecases/settings-reference';
import {
  SettingsReferenceResponseFormat,
  SettingsReferenceResponseSchema,
} from './settings-reference-schema';

const MODEL = '@cf/zai-org/glm-5.3-flash';
// JSON schema 制約下では文字列の途中でも空白が合法な継続になるため、モデルが閉じ括弧を出せずに
// 空白を吐き続けることがある。上限を切って、暴走しても数十秒で打ち切らせ step の再試行に回す。
// 8192 は D1 の生成済み 622 件のうち最も長い 30 件(9,445字)から見積もった約5,400トークンの1.5倍
const MAX_COMPLETION_TOKENS = 8192;
const MODEL_CONTEXT = [
  '- CHANGELOG の原文や snippets に記載されていないモデル名・バージョン番号・スペック値を捏造しないこと',
  '- CHANGELOG の原文に具体的なモデル名が記載されている場合はそのまま使用すること',
].join('\n');

const logger = getLogger({
  name: 'infrastructure.ai.settings-reference',
  serviceName: 'changelog-viewer-worker',
  level: 'INFO',
  format: 'json',
});

const AiChatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({ content: z.string().min(1) }),
      }),
    )
    .min(1),
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
      prompt_tokens_details: z
        .object({ cached_tokens: z.number().optional() })
        .optional(),
    })
    .optional(),
});

/** Workers AI を設定リファレンス生成 port に接続する adapter。 */
export function createSettingsReferenceAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): SettingsReferenceAiPort {
  return {
    async infer(input): Promise<SettingsReferenceTranslation[]> {
      const startedAt = Date.now();
      let response: unknown;
      try {
        response = await ai.run(
          MODEL,
          {
            messages: [
              {
                role: 'user',
                content: buildSettingsReferencePrompt(input),
              },
            ],
            max_completion_tokens: MAX_COMPLETION_TOKENS,
            // 思考トークンは出力本体の数倍に達し、量が回ごとに大きく揺れる
            chat_template_kwargs: { enable_thinking: false },
            response_format: SettingsReferenceResponseFormat,
          },
          { gateway: { id: gatewayId } },
        );
      } catch (error) {
        logger.error('Workers AI の呼び出しに失敗しました', {
          'ai.model': MODEL,
          'ai.duration_ms': Date.now() - startedAt,
          error: toError(error),
        });
        throw error;
      }
      logAiUsage(response, startedAt);
      const parsed = SettingsReferenceResponseSchema.safeParse(
        parseAiResponse(response),
      );
      if (!parsed.success) {
        throw new Error(
          `AI 設定リファレンス結果の形式が不正です: ${z.prettifyError(parsed.error)}`,
        );
      }

      return parsed.data.results.map((item) => ({
        id: item.id,
        descriptionJa: item.description_ja,
        useCaseJa: item.use_case_ja,
        enumDescriptionsJa: item.enum_descriptions_ja.map((description) => ({
          value: description.value,
          descriptionJa: description.description_ja,
        })),
        defaultNoteJa: item.default_note_ja,
      }));
    },
  };
}

function logAiUsage(response: unknown, startedAt: number): void {
  const parsed = AiChatResponseSchema.safeParse(response);
  const usage = parsed.success ? parsed.data.usage : undefined;
  logger.info('Workers AI の呼び出しが完了しました', {
    'ai.model': MODEL,
    'ai.usage.prompt_tokens': usage?.prompt_tokens,
    'ai.usage.completion_tokens': usage?.completion_tokens,
    'ai.usage.total_tokens': usage?.total_tokens,
    'ai.usage.cached_tokens': usage?.prompt_tokens_details?.cached_tokens ?? 0,
    'ai.duration_ms': Date.now() - startedAt,
  });
}

function parseAiResponse(response: unknown): unknown {
  const parsed = AiChatResponseSchema.safeParse(response);
  if (!parsed.success) {
    throw new Error(
      `AI 応答の形式が不正です: ${z.prettifyError(parsed.error)}`,
    );
  }

  const content = parsed.data.choices[0]?.message.content;
  if (content === undefined) {
    throw new Error('AI 応答に choices がありません');
  }

  try {
    return JSON.parse(content);
  } catch (error) {
    throw new Error('AI 応答の JSON 解析に失敗しました', { cause: error });
  }
}

export function buildSettingsReferencePrompt(
  input: SettingsReferenceInput,
): string {
  const withContext = input.entries.filter(
    (entry) =>
      entry.docSnippets.length > 0 || entry.relatedChangelog.length > 0,
  );
  const withoutContext = input.entries.filter(
    (entry) =>
      entry.docSnippets.length === 0 && entry.relatedChangelog.length === 0,
  );

  const contextSection = withContext
    .map((entry) => buildContextEntry(entry))
    .join('\n\n');
  const translationSection = withoutContext
    .map((entry) => buildTranslationEntry(entry))
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
    MODEL_CONTEXT,
    '',
    '## 動機 (Motive)',
    '設定のデフォルト値や選択肢はスキーマから取得できるが、「なぜその値を変えるのか」「どんな状況で有効化するのか」はドキュメントや更新履歴にしか載っていない。両者を組み合わせてユーザーが即座に使える情報を提供する。',
    '',
    '## 状況 (Situation)',
    `Claude Code の設定・環境変数 ${input.entries.length} 件を処理する。`,
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
    '- enum_descriptions_ja: 「選択肢ごとの英語の説明」がある場合、値ごとに英文を1文の日本語へ訳して返す。ない場合は空配列を返す',
    '  - value は英文に並んだ値をそのまま返し、英文にない値を作らない',
    '  - value は `stable` のように引用符を付けずに返し、値そのものを日本語に置き換えない',
    '- default_note_ja: 「既定値の英語の補足」がある場合、1文の日本語へ訳して返す。ない場合は空文字で返す',
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
    '- enum_descriptions_ja: 「選択肢ごとの英語の説明」がある場合、値ごとに英文を1文の日本語へ訳して返す。ない場合は空配列を返す',
    '  - value は英文に並んだ値をそのまま返し、英文にない値を作らない',
    '  - value は `stable` のように引用符を付けずに返し、値そのものを日本語に置き換えない',
    '- default_note_ja: 「既定値の英語の補足」がある場合、1文の日本語へ訳して返す。ない場合は空文字で返す',
    '- id は入力値をそのまま返すこと',
    '',
    '## 対象エントリ',
    '',
    translationSection || '(対象なし)',
    '',
    '---',
    '',
    '# 出力前の確認',
    '- `_ja` で終わる値はすべて自然な日本語で返し、英語の原文をそのまま返さないこと',
    '- 日本語にする内容がない場合は、文字列を空文字または配列を空配列で返すこと',
  ]
    .join('\n')
    .trim();
}

function buildSchemaText(
  schemaDefault: string | undefined,
  schemaEnum: string[] | undefined,
): string {
  const parts: string[] = [];
  if (schemaDefault !== undefined) {
    parts.push(`デフォルト値: ${JSON.stringify(schemaDefault)}`);
  }
  if (schemaEnum !== undefined && schemaEnum.length > 0) {
    parts.push(
      `選択肢: [${schemaEnum.map((value) => JSON.stringify(value)).join(', ')}]`,
    );
  }
  return parts.length > 0
    ? ['### スキーマ情報', `- ${parts.join(', ')}`].join('\n')
    : '';
}

/** 選択肢ごとの説明と既定値の補足を、公式の英文のまま AI に渡す。 */
function buildOfficialTextsSection(entry: SettingsReferenceInputEntry): string {
  const sections: string[] = [];
  if (entry.enumDescriptions !== undefined) {
    sections.push(
      [
        '### 選択肢ごとの英語の説明',
        ...Object.entries(entry.enumDescriptions).map(
          // 引用符を付けて示すと AI が引用符ごと写して返し、保存前の照合で捨てられる
          ([value, description]) => `- \`${value}\`: ${description}`,
        ),
      ].join('\n'),
    );
  }
  if (entry.defaultNote !== undefined) {
    sections.push(
      ['### 既定値の英語の補足', `- ${entry.defaultNote}`].join('\n'),
    );
  }
  return sections.join('\n');
}

function buildContextEntry(entry: SettingsReferenceInputEntry): string {
  const sourceLabel =
    entry.source === 'settings' ? 'settings.json 設定' : '環境変数';
  const parentText =
    entry.parentDescriptions.length > 0
      ? [
          '### 親オブジェクトの説明',
          entry.parentDescriptions
            .map((description) => `- ${description}`)
            .join('\n'),
        ].join('\n')
      : '';
  const docsText =
    entry.docSnippets.length > 0
      ? ['### 関連ドキュメント', entry.docSnippets.join('\n\n')].join('\n')
      : '';
  const changelogText =
    entry.relatedChangelog.length > 0
      ? [
          '### 関連更新履歴',
          entry.relatedChangelog
            .map((changelog) => {
              const lines: string[] = [];
              if (changelog.contentJa) {
                lines.push(`- ${changelog.contentJa}`);
              }
              if (changelog.inference) {
                lines.push(`  変更前: ${changelog.inference.before}`);
                lines.push(`  変更後: ${changelog.inference.after}`);
                lines.push(`  恩恵: ${changelog.inference.benefit}`);
              }
              return lines.join('\n');
            })
            .join('\n'),
        ].join('\n')
      : '';
  const schemaText = buildSchemaText(entry.schemaDefault, entry.schemaEnum);

  return [
    `#### エントリ id=${entry.id} (${sourceLabel})`,
    `- キー: \`${entry.key}\``,
    `- 英語説明: ${entry.descriptionEn}`,
    parentText,
    schemaText,
    buildOfficialTextsSection(entry),
    docsText,
    changelogText,
  ]
    .filter((line) => line.length > 0)
    .join('\n')
    .trim();
}

function buildTranslationEntry(entry: SettingsReferenceInputEntry): string {
  const sourceLabel =
    entry.source === 'settings' ? 'settings.json 設定' : '環境変数';
  const schemaText = buildSchemaText(entry.schemaDefault, entry.schemaEnum);
  return [
    `#### エントリ id=${entry.id} (${sourceLabel})`,
    `- キー: \`${entry.key}\``,
    `- 英語説明: ${entry.descriptionEn}`,
    schemaText,
    buildOfficialTextsSection(entry),
  ]
    .filter((line) => line.length > 0)
    .join('\n');
}
