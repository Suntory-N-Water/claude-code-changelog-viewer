import { z } from 'zod';
import type {
  SettingsReferenceInputEntry,
  SettingsReferenceTranslation,
  SettingsReferenceTranslationPort,
  SettingsReferenceUseCasePort,
} from '../../usecases/settings-reference';
import {
  SettingsTranslationResponseFormat,
  SettingsTranslationResponseSchema,
  SettingsUseCaseResponseFormat,
  SettingsUseCaseResponseSchema,
} from './settings-reference-schema';
import {
  PARSE_FAILED_MESSAGE,
  runJsonChat,
  TRUNCATED_MESSAGE,
  withoutDoubleQuotes,
} from './workers-ai';

// 30 件の翻訳は本番データで約 3,000〜4,000 トークン出力する
const TRANSLATION_MAX_COMPLETION_TOKENS = 8192;
// 1 件の用途は箇条書き 3 行で 300 トークン前後に収まる
const USE_CASE_MAX_COMPLETION_TOKENS = 2048;

const TRANSLATION_SCHEMA_FAILED_MESSAGE = 'AI 設定翻訳結果の形式が不正です';
const USE_CASE_SCHEMA_FAILED_MESSAGE = 'AI 設定用途結果の形式が不正です';

const UNUSABLE_RESPONSE_MESSAGES = [
  TRUNCATED_MESSAGE,
  PARSE_FAILED_MESSAGE,
  TRANSLATION_SCHEMA_FAILED_MESSAGE,
  USE_CASE_SCHEMA_FAILED_MESSAGE,
];

/**
 * Workflow の step 境界を越えるとエラーは再生成され instanceof が使えないため、
 * メッセージで判定する。
 */
export function isUnusableSettingsAiResponseError(error: unknown): boolean {
  return (
    error instanceof Error &&
    UNUSABLE_RESPONSE_MESSAGES.some((message) => error.message.startsWith(message))
  );
}

export function createSettingsTranslationAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): SettingsReferenceTranslationPort {
  return {
    async translate(entries): Promise<SettingsReferenceTranslation[]> {
      const parsed = SettingsTranslationResponseSchema.safeParse(
        await runJsonChat(ai, gatewayId, {
          prompt: buildSettingsTranslationPrompt(entries),
          maxCompletionTokens: TRANSLATION_MAX_COMPLETION_TOKENS,
          responseFormat: SettingsTranslationResponseFormat,
        }),
      );
      if (!parsed.success) {
        throw new Error(`${TRANSLATION_SCHEMA_FAILED_MESSAGE}: ${z.prettifyError(parsed.error)}`);
      }

      return parsed.data.results.map((item) => ({
        id: item.id,
        descriptionJa: item.description_ja,
        enumDescriptionsJa: item.enum_descriptions_ja.map((description) => ({
          value: description.value,
          descriptionJa: description.description_ja,
        })),
        defaultNoteJa: item.default_note_ja,
      }));
    },
  };
}

export function createSettingsUseCaseAi(
  ai: Pick<Cloudflare.Env['AI'], 'run'>,
  gatewayId: string,
): SettingsReferenceUseCasePort {
  return {
    async describeUseCase(entry): Promise<string> {
      const parsed = SettingsUseCaseResponseSchema.safeParse(
        await runJsonChat(ai, gatewayId, {
          prompt: buildSettingsUseCasePrompt(entry),
          maxCompletionTokens: USE_CASE_MAX_COMPLETION_TOKENS,
          responseFormat: SettingsUseCaseResponseFormat,
        }),
      );
      if (!parsed.success) {
        throw new Error(`${USE_CASE_SCHEMA_FAILED_MESSAGE}: ${z.prettifyError(parsed.error)}`);
      }

      return parsed.data.use_cases_ja
        .map((useCase) => useCase.trim().replace(/^-\s*/, ''))
        .filter((useCase) => useCase !== '')
        .map((useCase) => `- ${useCase}`)
        .join('\n');
    },
  };
}

const PROMPT_PREAMBLE = [
  '## 前提',
  '- Claude Code は開発者向けの AI アシスタント CLI ツールである',
  '- 読み手は設定名・環境変数名で検索して来訪し、その設定が何をするのか・いつ使うのかを知りたい',
  '- 技術用語を適切に日本語化し、開発者にとって自然な日本語で表現する',
  '- 英語説明・関連ドキュメント・更新履歴にない内容を捏造しない',
].join('\n');

// モデルは学習時点の知識から実在しないモデル名や古い版数を補いがちなため、明示して止める
const MODEL_NAME_RULES = [
  '## Claude Code のモデル情報 (重要)',
  '- 英語説明や関連ドキュメントに記載されていないモデル名・バージョン番号・スペック値を捏造しない',
  '- 英語説明に具体的なモデル名が記載されている場合はそのまま使う',
].join('\n');

function sourceLabel(entry: SettingsReferenceInputEntry): string {
  return entry.source === 'settings' ? 'settings.json 設定' : '環境変数';
}

export function buildSettingsTranslationPrompt(entries: SettingsReferenceInputEntry[]): string {
  const items = entries
    .map((entry) => {
      const lines = [
        `### 項目 id=${entry.id} (${sourceLabel(entry)})`,
        `- キー: \`${entry.key}\``,
        `- 英語説明: ${withoutDoubleQuotes(entry.descriptionEn)}`,
      ];
      if (entry.enumDescriptions !== undefined) {
        lines.push(
          '- 選択肢ごとの英語の説明:',
          ...Object.entries(entry.enumDescriptions).map(
            // 引用符を付けて示すと AI が引用符ごと写して返し、英文にない値として保存前に捨てられる
            ([value, description]) => `  - \`${value}\`: ${withoutDoubleQuotes(description)}`,
          ),
        );
      }
      if (entry.defaultNote !== undefined) {
        lines.push(`- 既定値の英語の補足: ${withoutDoubleQuotes(entry.defaultNote)}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');

  return [
    PROMPT_PREAMBLE,
    '',
    MODEL_NAME_RULES,
    '',
    `## 状況\nClaude Code の設定・環境変数 ${entries.length} 件の英語説明を日本語に翻訳する。`,
    '',
    '# タスク: 翻訳',
    '- description_ja: 英語説明の意味を正確に保ち、自然な日本語にする',
    // 1 文に縮めさせると、取りうる値や必要なバージョンなどの後半の文が訳から落ちた
    '  - 英語説明のすべての文を訳し、要約や省略をしない',
    // 公式ドキュメントへのリンクは画面に別欄で並べるため、訳に残すと同じ案内が 2 回出る
    '  - 「See https://...」「See <ページ名> for ...」のような参照先を案内する文は訳さない',
    '- enum_descriptions_ja: 「選択肢ごとの英語の説明」がある項目だけ、値ごとに1文の日本語へ訳して返す。ない項目は空配列を返す',
    '  - value は英文に並んだ値をそのまま返し、英文にない値を作らない',
    '  - value は `stable` のように引用符を付けずに返し、値そのものを日本語に置き換えない',
    '- default_note_ja: 「既定値の英語の補足」がある項目だけ、1文の日本語へ訳して返す。ない項目は空文字を返す',
    '- 設定キー・環境変数名・コマンド名・ファイル名・値は原文の表記のまま残す',
    '- 常体(である調)で書き、各文を「。」で終える',
    '- 全項目を1件ずつ返し、id は入力値をそのまま返す',
    '',
    items,
  ].join('\n');
}

export function buildSettingsUseCasePrompt(entry: SettingsReferenceInputEntry): string {
  const sections = [
    `### 設定 (${sourceLabel(entry)})`,
    `- キー: \`${entry.key}\``,
    `- 英語説明: ${withoutDoubleQuotes(entry.descriptionEn)}`,
    ...entry.parentDescriptions.map(
      (description) => `- 親オブジェクトの説明: ${withoutDoubleQuotes(description)}`,
    ),
  ];
  if (entry.docSnippets.length > 0) {
    sections.push('', '### 関連ドキュメント', withoutDoubleQuotes(entry.docSnippets.join('\n\n')));
  }
  if (entry.relatedChangelog.length > 0) {
    sections.push(
      '',
      '### 関連する CHANGELOG の原文',
      ...entry.relatedChangelog.map(
        (changelog) =>
          `- v${changelog.version}: ${withoutDoubleQuotes(changelog.content.replace(/^- /, ''))}`,
      ),
    );
  }

  return [
    PROMPT_PREAMBLE,
    '',
    MODEL_NAME_RULES,
    '',
    `## 状況\n設定 \`${entry.key}\` を使う場面を、関連ドキュメントと CHANGELOG から読み取って書く。`,
    '',
    '# タスク: 用途',
    '- use_cases_ja: この設定を使う場面や、設定することで解決できる課題を 2〜3 個、1 要素 1 文で書く',
    '  - 各要素は記号を付けずに書き始め、常体(である調)で「。」で終える',
    '  - 英語説明の翻訳や言い換えにしない。英語説明の訳は別の欄に表示する',
    '  - 既定値と取りうる値の一覧は別の欄に表示するため書かない',
    '  - 関連ドキュメントと CHANGELOG に記載がない効果や推測は書かない',
    '  - 関連ドキュメントと CHANGELOG にこの設定の使いどころが書かれていない場合は、空配列を返す',
    '- 設定キー・環境変数名・コマンド名・ファイル名・値は原文の表記のまま残す',
    '',
    sections.join('\n'),
  ].join('\n');
}
