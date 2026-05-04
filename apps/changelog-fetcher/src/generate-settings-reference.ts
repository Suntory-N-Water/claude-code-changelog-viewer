import { globSync, mkdirSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { GeminiClient } from './ai/gemini-client';
import type { SettingEntryForPrompt } from './ai/prompts/settings-translate-prompt';
import { buildSettingsTranslatePrompt } from './ai/prompts/settings-translate-prompt';
import { searchDocs } from './searchers/grep-executor';
import { PROJECT_ROOT } from './searchers/paths';
import { extractSnippets } from './searchers/snippet-extractor';

const log = getLogger({ name: 'settings-reference-generator' });

const SCHEMA_PATH = path.join(
  PROJECT_ROOT,
  'apps',
  'docs-tracker',
  'schema',
  'claude-code-settings.json',
);
const ENV_VARS_MD_PATH = path.join(
  PROJECT_ROOT,
  'apps',
  'docs-tracker',
  'docs',
  'en',
  'env-vars.md',
);
const INFERRED_DIR = path.join(process.cwd(), 'inferred');
const OUTPUT_DIR = path.join(process.cwd(), 'settings');

// docs 検索から除外するファイル(データ源と重複するため)
const EXCLUDED_DOC_FILES = new Set(['env-vars.md']);

type SettingSource = 'settings' | 'env';

type RawEntry = {
  key: string;
  source: SettingSource;
  description_en: string;
};

type RelatedChangelog = {
  version: string;
  content: string;
  content_ja?: string;
  inference?: {
    before: string;
    after: string;
    benefit: string;
  };
};

type SettingReference = {
  key: string;
  slug: string;
  source: SettingSource;
  description_en: string;
  description_ja: string;
  use_case_ja?: string;
  related_changelog: RelatedChangelog[];
};

/**
 * camelCase → kebab-case
 */
function camelToKebab(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '');
}

/**
 * SCREAMING_SNAKE_CASE → kebab-case
 */
function screamingSnakeToKebab(str: string): string {
  return str.toLowerCase().replace(/_/g, '-');
}

function toSlug(key: string, source: SettingSource): string {
  return source === 'settings' ? camelToKebab(key) : screamingSnakeToKebab(key);
}

type SchemaEnvProperty = {
  description?: string;
  type?: string;
};

type SchemaProperty = {
  description?: string;
  type?: string;
  properties?: Record<string, SchemaEnvProperty>;
};

type SettingsJsonSchema = {
  properties?: Record<string, SchemaProperty>;
};

/**
 * settings.json スキーマから設定エントリを抽出
 */
async function parseSettingsSchema(): Promise<RawEntry[]> {
  const raw = await fs.readFile(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(raw) as SettingsJsonSchema;

  const entries: RawEntry[] = [];
  const props = schema.properties ?? {};

  for (const [key, value] of Object.entries(props)) {
    if (key === '$schema') {
      continue;
    }

    // env セクションの各環境変数を抽出
    if (key === 'env') {
      const envProps = value.properties ?? {};
      for (const [envKey, envValue] of Object.entries(envProps)) {
        entries.push({
          key: envKey,
          source: 'env',
          description_en: envValue.description ?? '',
        });
      }
      continue;
    }

    entries.push({
      key,
      source: 'settings',
      description_en: value.description ?? '',
    });
  }

  return entries;
}

/**
 * env-vars.md の Markdown テーブルから環境変数エントリを抽出
 */
async function parseEnvVarsMd(): Promise<RawEntry[]> {
  const raw = await fs.readFile(ENV_VARS_MD_PATH, 'utf-8');
  const entries: RawEntry[] = [];

  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('| `') || trimmed.startsWith('| `Variable')) {
      continue;
    }

    const parts = trimmed.split('`');
    if (parts.length < 3) {
      continue;
    }

    const key = parts[1];
    if (!key || !/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      continue;
    }

    // | `KEY` | description | の description 部分を取得
    const afterKey = trimmed.slice(trimmed.indexOf('`', 3) + 1).trim();
    const descriptionRaw = afterKey.startsWith('|')
      ? (afterKey.slice(1).split('|')[0]?.trim() ?? '')
      : '';

    entries.push({
      key,
      source: 'env',
      description_en: descriptionRaw,
    });
  }

  return entries;
}

/**
 * env-vars.md(一次ソース)と schema.env(補完)をマージ
 * 重複は env-vars.md 側を優先
 */
function mergeEnvEntries(
  mdEntries: RawEntry[],
  schemaEntries: RawEntry[],
): RawEntry[] {
  const mdKeys = new Set(mdEntries.map((e) => e.key));
  const schemaOnly = schemaEntries.filter((e) => !mdKeys.has(e.key));
  return [...mdEntries, ...schemaOnly];
}

type FlatChangelogItem = {
  version: string;
  content: string;
  content_ja?: string;
  inference?: {
    before: string;
    after: string;
    benefit: string;
  };
};

/**
 * inferred_v*.json を全件読み込んでフラットな配列に展開
 */
async function loadAllInferred(): Promise<FlatChangelogItem[]> {
  const files = globSync('inferred_v*.json', { cwd: INFERRED_DIR })
    .map(String)
    .map((f) => path.join(INFERRED_DIR, f));

  const items: FlatChangelogItem[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await fs.readFile(file, 'utf-8');
        const parsed = AnalysisSchema.parse(JSON.parse(raw));
        for (const item of parsed.items) {
          items.push({
            version: parsed.version,
            content: item.content,
            ...(item.content_ja !== undefined
              ? { content_ja: item.content_ja }
              : {}),
            ...(item.inference !== undefined
              ? { inference: item.inference }
              : {}),
          });
        }
      } catch {
        // パース失敗は無視して続行
      }
    }),
  );

  return items;
}

/**
 * 設定名が content または content_ja に含まれる ChangelogItem を抽出
 */
function findRelatedChangelogs(
  key: string,
  allItems: FlatChangelogItem[],
): RelatedChangelog[] {
  return allItems.filter(
    (item) =>
      item.content.includes(key) || (item.content_ja?.includes(key) ?? false),
  );
}

/**
 * 設定名をキーワードに docs/en/ を検索してスニペットを取得
 * env-vars.md は除外(データ源と重複するため)
 */
async function searchRelatedDocs(key: string): Promise<string[]> {
  const keywords = { original: [key], normalized: [key] };
  const searchResult = await searchDocs(keywords);

  const filteredFiles = searchResult.files.filter(
    (f) => !EXCLUDED_DOC_FILES.has(path.basename(f)),
  );
  if (filteredFiles.length === 0) {
    return [];
  }

  const snippetResults = await extractSnippets(filteredFiles, keywords);
  return snippetResults.flatMap((r) => r.snippets);
}

type TranslateContext = {
  docSnippetsMap: Map<string, string[]>;
  changelogsMap: Map<string, RelatedChangelog[]>;
  geminiClient: GeminiClient;
};

/**
 * 設定エントリを 30 件ずつのバッチに分割して Gemini API に送信
 */
async function translateInBatches(
  entries: RawEntry[],
  ctx: TranslateContext,
): Promise<Map<number, { description_ja: string; use_case_ja: string }>> {
  const { docSnippetsMap, changelogsMap, geminiClient } = ctx;
  const BATCH_SIZE = 30;
  const resultMap = new Map<
    number,
    { description_ja: string; use_case_ja: string }
  >();

  for (
    let batchStart = 0;
    batchStart < entries.length;
    batchStart += BATCH_SIZE
  ) {
    const batch = entries.slice(batchStart, batchStart + BATCH_SIZE);
    log.info(
      `バッチ処理: ${batchStart + 1}〜${Math.min(batchStart + BATCH_SIZE, entries.length)} / ${entries.length}`,
    );

    const promptEntries: SettingEntryForPrompt[] = batch.map((entry, i) => ({
      id: batchStart + i,
      key: entry.key,
      source: entry.source,
      description_en: entry.description_en,
      doc_snippets: docSnippetsMap.get(entry.key) ?? [],
      related_changelog: (changelogsMap.get(entry.key) ?? []).map((c) => ({
        ...(c.content_ja !== undefined ? { content_ja: c.content_ja } : {}),
        ...(c.inference !== undefined ? { inference: c.inference } : {}),
      })),
    }));

    const prompt = buildSettingsTranslatePrompt(promptEntries);
    const result = await geminiClient.translateSettings(prompt);

    for (const item of result.results) {
      resultMap.set(item.id, {
        description_ja: item.description_ja,
        use_case_ja: item.use_case_ja,
      });
    }
  }

  return resultMap;
}

async function main() {
  log.info('設定・環境変数リファレンス生成を開始');

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!apiKey) {
    log.error('GEMINI_API_KEY 環境変数が設定されていません');
    process.exit(1);
  }

  // データ源をパース
  log.info('settings.json スキーマを解析中...');
  const schemaEntries = await parseSettingsSchema();
  const schemaSettings = schemaEntries.filter((e) => e.source === 'settings');
  const schemaEnvEntries = schemaEntries.filter((e) => e.source === 'env');

  log.info('env-vars.md を解析中...');
  const mdEnvEntries = await parseEnvVarsMd();

  const mergedEnvEntries = mergeEnvEntries(mdEnvEntries, schemaEnvEntries);
  const allEntries = [...schemaSettings, ...mergedEnvEntries];
  log.info(
    `設定: ${schemaSettings.length}件, 環境変数: ${mergedEnvEntries.length}件, 合計: ${allEntries.length}件`,
  );

  // 生成済みファイルのキーを収集してスキップ対象を決定
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const existingKeys = new Set(
    globSync('settings_*.json', { cwd: OUTPUT_DIR })
      .map(String)
      .map((f) => {
        const raw = readFileSync(path.join(OUTPUT_DIR, f), 'utf-8');
        return (JSON.parse(raw) as { key: string }).key;
      }),
  );
  const newEntries = allEntries.filter((e) => !existingKeys.has(e.key));
  log.info(
    `生成済みスキップ: ${existingKeys.size}件, 新規生成対象: ${newEntries.length}件`,
  );

  if (newEntries.length === 0) {
    log.info('新規生成対象なし。処理を終了します');
    return;
  }

  // inferred_*.json を全件読み込み
  log.info('更新履歴を読み込み中...');
  const allInferred = await loadAllInferred();
  log.info(`更新履歴アイテム: ${allInferred.length}件`);

  // 各エントリの関連 changelog と docs スニペットを収集
  log.info('関連情報を収集中...');
  const changelogsMap = new Map<string, RelatedChangelog[]>();
  const docSnippetsMap = new Map<string, string[]>();

  await Promise.all(
    newEntries.map(async (entry) => {
      changelogsMap.set(
        entry.key,
        findRelatedChangelogs(entry.key, allInferred),
      );
      docSnippetsMap.set(entry.key, await searchRelatedDocs(entry.key));
    }),
  );

  const withContextCount = newEntries.filter(
    (e) =>
      (docSnippetsMap.get(e.key)?.length ?? 0) > 0 ||
      (changelogsMap.get(e.key)?.length ?? 0) > 0,
  ).length;
  log.info(
    `コンテキストあり: ${withContextCount}件, コンテキストなし: ${newEntries.length - withContextCount}件`,
  );

  // Gemini API でバッチ翻訳・用途解説生成
  const geminiClient = new GeminiClient(apiKey, log);
  let translationMap: Map<
    number,
    { description_ja: string; use_case_ja: string }
  >;
  try {
    translationMap = await translateInBatches(newEntries, {
      docSnippetsMap,
      changelogsMap,
      geminiClient,
    });
  } catch (error) {
    log.error('翻訳処理に失敗しました', { error: toError(error) });
    process.exit(1);
  }

  // 各設定・環境変数の JSON ファイルを出力
  let writtenCount = 0;
  await Promise.all(
    newEntries.map(async (entry, index) => {
      const translation = translationMap.get(index);
      if (!translation) {
        return;
      }

      const slug = toSlug(entry.key, entry.source);
      const relatedChangelog = changelogsMap.get(entry.key) ?? [];

      const ref: SettingReference = {
        key: entry.key,
        slug,
        source: entry.source,
        description_en: entry.description_en,
        description_ja: translation.description_ja,
        ...(translation.use_case_ja
          ? { use_case_ja: translation.use_case_ja }
          : {}),
        related_changelog: relatedChangelog,
      };

      const outputPath = path.join(OUTPUT_DIR, `settings_${slug}.json`);
      await fs.writeFile(outputPath, JSON.stringify(ref, null, 2));
      writtenCount += 1;
    }),
  );

  log.info(`完了: ${writtenCount}件のファイルを ${OUTPUT_DIR} に出力しました`);
}

main().catch((error) => {
  log.error('予期しないエラーが発生しました', { error: toError(error) });
  process.exit(1);
});
