import { globSync, mkdirSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildChangelogSearchTerms,
  getLogger,
  toError,
} from '@claude-code-changelog-viewer/common';
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

const EXCLUDED_DOC_FILES = new Set(['env-vars.md']);

type SettingSource = 'settings' | 'env';

type RawEntry = {
  key: string;
  leaf_name: string;
  source: SettingSource;
  description_en: string;
  parent_descriptions: string[];
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
  leaf_name: string;
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
  if (source === 'env') {
    return screamingSnakeToKebab(key);
  }
  return key.split('.').map(camelToKebab).join('-');
}

type SchemaEnvProperty = {
  description?: string;
  type?: string;
};

type SchemaProperty = {
  description?: string;
  type?: string;
  properties?: Record<string, SchemaProperty>;
  items?: SchemaProperty;
};

type SettingsJsonSchema = {
  properties?: Record<string, SchemaProperty>;
};

type CollectLeafCtx = {
  parentDescriptions: string[];
  source: SettingSource;
};

/**
 * スキーマノードを再帰的に走査してリーフノードを収集する
 * リーフ = properties を持たないノード
 */
function collectLeafEntries(
  obj: SchemaProperty,
  path: string,
  ctx: CollectLeafCtx,
): RawEntry[] {
  const results: RawEntry[] = [];

  if (!obj.properties) {
    const segments = path.split('.');
    const leaf_name = segments.at(-1) ?? path;
    results.push({
      key: path,
      leaf_name,
      source: ctx.source,
      description_en: obj.description ?? '',
      parent_descriptions: ctx.parentDescriptions,
    });
    return results;
  }

  const currentDescs =
    obj.description !== undefined
      ? [...ctx.parentDescriptions, obj.description]
      : ctx.parentDescriptions;

  for (const [childKey, childValue] of Object.entries(obj.properties)) {
    const childPath = path ? `${path}.${childKey}` : childKey;
    results.push(
      ...collectLeafEntries(childValue, childPath, {
        parentDescriptions: currentDescs,
        source: ctx.source,
      }),
    );
  }

  return results;
}

/**
 * settings.json スキーマからリーフ設定エントリを抽出
 * env セクションは別処理、それ以外のプロパティを再帰的に収集
 */
async function parseSettingsSchema(): Promise<{
  settings: RawEntry[];
  envFromSchema: RawEntry[];
}> {
  const raw = await fs.readFile(SCHEMA_PATH, 'utf-8');
  const schema = JSON.parse(raw) as SettingsJsonSchema;

  const settings: RawEntry[] = [];
  const envFromSchema: RawEntry[] = [];
  const props = schema.properties ?? {};

  for (const [key, value] of Object.entries(props)) {
    if (key === '$schema') {
      continue;
    }

    if (key === 'env') {
      const envProps = value.properties ?? {};
      for (const [envKey, envValue] of Object.entries(envProps)) {
        envFromSchema.push({
          key: envKey,
          leaf_name: envKey,
          source: 'env',
          description_en: (envValue as SchemaEnvProperty).description ?? '',
          parent_descriptions: [],
        });
      }
      continue;
    }

    const leaves = collectLeafEntries(value, key, {
      parentDescriptions: [],
      source: 'settings',
    });
    settings.push(...leaves);
  }

  return { settings, envFromSchema };
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

    const afterKey = trimmed.slice(trimmed.indexOf('`', 3) + 1).trim();
    const descriptionRaw = afterKey.startsWith('|')
      ? (afterKey.slice(1).split('|')[0]?.trim() ?? '')
      : '';

    entries.push({
      key,
      leaf_name: key,
      source: 'env',
      description_en: descriptionRaw,
      parent_descriptions: [],
    });
  }

  return entries;
}

/**
 * env-vars.md(一次ソース)と schema.env(補完)をマージ
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
 * フルパスと末端名の両方で changelog を検索する
 */
function findRelatedChangelogs(
  key: string,
  allItems: FlatChangelogItem[],
): RelatedChangelog[] {
  const searchTerms = buildChangelogSearchTerms(key);
  return allItems.filter((item) =>
    searchTerms.some(
      (term) =>
        item.content.includes(term) ||
        (item.content_ja?.includes(term) ?? false),
    ),
  );
}

/**
 * 末端名をキーワードに docs/en/ を検索してスニペットを取得
 */
async function searchRelatedDocs(leaf_name: string): Promise<string[]> {
  const keywords = { original: [leaf_name], normalized: [leaf_name] };
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
      parent_descriptions: entry.parent_descriptions,
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

/**
 * AI なしモード: description_en をそのまま description_ja として使用
 */
function buildNoAiTranslationMap(
  entries: RawEntry[],
): Map<number, { description_ja: string; use_case_ja: string }> {
  const resultMap = new Map<
    number,
    { description_ja: string; use_case_ja: string }
  >();
  for (const [i, entry] of entries.entries()) {
    resultMap.set(i, {
      description_ja: entry.description_en,
      use_case_ja: '',
    });
  }
  return resultMap;
}

async function main() {
  const noAiMode = process.env['SETTINGS_NO_AI'] === '1';
  log.info(`設定・環境変数リファレンス生成を開始 (AIモード: ${!noAiMode})`);

  if (!noAiMode) {
    const apiKey = process.env['GEMINI_API_KEY'];
    if (!apiKey) {
      log.error('GEMINI_API_KEY 環境変数が設定されていません');
      process.exit(1);
    }
  }

  log.info('settings.json スキーマを解析中...');
  const { settings: schemaSettings, envFromSchema: schemaEnvEntries } =
    await parseSettingsSchema();

  log.info('env-vars.md を解析中...');
  const mdEnvEntries = await parseEnvVarsMd();

  const mergedEnvEntries = mergeEnvEntries(mdEnvEntries, schemaEnvEntries);
  const allEntries = [...schemaSettings, ...mergedEnvEntries];
  log.info(
    `設定: ${schemaSettings.length}件, 環境変数: ${mergedEnvEntries.length}件, 合計: ${allEntries.length}件`,
  );

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

  log.info('更新履歴を読み込み中...');
  const allInferred = await loadAllInferred();
  log.info(`更新履歴アイテム: ${allInferred.length}件`);

  log.info('関連情報を収集中...');
  const changelogsMap = new Map<string, RelatedChangelog[]>();
  const docSnippetsMap = new Map<string, string[]>();

  await Promise.all(
    newEntries.map(async (entry) => {
      changelogsMap.set(
        entry.key,
        findRelatedChangelogs(entry.key, allInferred),
      );
      docSnippetsMap.set(entry.key, await searchRelatedDocs(entry.leaf_name));
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

  let translationMap: Map<
    number,
    { description_ja: string; use_case_ja: string }
  >;

  if (noAiMode) {
    log.info('AI なしモード: 翻訳をスキップします');
    translationMap = buildNoAiTranslationMap(newEntries);
  } else {
    const apiKey = process.env['GEMINI_API_KEY'] as string;
    const geminiClient = new GeminiClient(apiKey, log);
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
  }

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
        leaf_name: entry.leaf_name,
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
