import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { GeminiClient } from './ai/gemini-client';
import {
  collectRelatedContext,
  countEntriesWithContext,
  loadAllInferred,
} from './lib/settings-related-context';
import {
  findUnmergedPublicEnvMentions,
  loadBuiltinEnvNames,
  mergeEnvEntries,
  parseEnvVarsMd,
  parsePublicEnvEntriesFromDocs,
  parseSettingsSchema,
} from './lib/settings-entry-loader';
import {
  loadExistingSettingKeys,
  writeSettingEntryFiles,
} from './lib/settings-entry-writer';
import {
  buildNoAiTranslationMap,
  translateInBatches,
} from './lib/settings-entry-translator';
import type { TranslationMap } from './lib/settings-entry-types';
import { PROJECT_ROOT } from './searchers/paths';

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
const DOCS_EN_DIR = path.join(
  PROJECT_ROOT,
  'apps',
  'docs-tracker',
  'docs',
  'en',
);
const BUILTIN_ENVS_JSON_PATH = path.join(
  PROJECT_ROOT,
  'apps',
  'changelog-fetcher',
  'builtin-data',
  'envs.json',
);
const INFERRED_DIR = path.join(process.cwd(), 'inferred');
const OUTPUT_DIR = path.join(process.cwd(), 'settings');

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
    await parseSettingsSchema(SCHEMA_PATH);

  log.info('組み込み環境変数一覧を読み込み中...');
  const builtinEnvNames = await loadBuiltinEnvNames(BUILTIN_ENVS_JSON_PATH);

  log.info('env-vars.md を解析中...');
  const mdEnvEntries = await parseEnvVarsMd(ENV_VARS_MD_PATH, builtinEnvNames);

  log.info('docs/en から公開環境変数を解析中...');
  const docsEnvEntries = await parsePublicEnvEntriesFromDocs(
    DOCS_EN_DIR,
    builtinEnvNames,
  );

  const mergedEnvEntries = mergeEnvEntries(
    mdEnvEntries,
    schemaEnvEntries,
    docsEnvEntries,
  );
  const allEntries = [...schemaSettings, ...mergedEnvEntries];
  log.info(
    `設定: ${schemaSettings.length}件, 環境変数: ${mergedEnvEntries.length}件 (env-vars.md=${mdEnvEntries.length}, schema=${schemaEnvEntries.length}, docs=${docsEnvEntries.length}), 合計: ${allEntries.length}件`,
  );

  const unmergedPublicEnvMentions = findUnmergedPublicEnvMentions(
    DOCS_EN_DIR,
    builtinEnvNames,
    mergedEnvEntries,
  );
  if (unmergedPublicEnvMentions.length > 0) {
    log.warn(
      `docs/en に出現する未取り込みの組み込み環境変数: ${unmergedPublicEnvMentions.join(', ')}`,
    );
  }

  const existingKeys = loadExistingSettingKeys(OUTPUT_DIR);
  const newEntries = allEntries.filter((e) => !existingKeys.has(e.key));
  log.info(
    `生成済みスキップ: ${existingKeys.size}件, 新規生成対象: ${newEntries.length}件`,
  );

  if (newEntries.length === 0) {
    log.info('新規生成対象なし。処理を終了します');
    return;
  }

  log.info('更新履歴を読み込み中...');
  const allInferred = await loadAllInferred(INFERRED_DIR);
  log.info(`更新履歴アイテム: ${allInferred.length}件`);

  log.info('関連情報を収集中...');
  const relatedContext = await collectRelatedContext(newEntries, allInferred);
  const withContextCount = countEntriesWithContext(newEntries, relatedContext);
  log.info(
    `コンテキストあり: ${withContextCount}件, コンテキストなし: ${newEntries.length - withContextCount}件`,
  );

  let translationMap: TranslationMap;

  if (noAiMode) {
    log.info('AI なしモード: 翻訳をスキップします');
    translationMap = buildNoAiTranslationMap(newEntries);
  } else {
    const apiKey = process.env['GEMINI_API_KEY'] as string;
    const geminiClient = new GeminiClient(apiKey, log);
    try {
      translationMap = await translateInBatches(newEntries, {
        docSnippetsMap: relatedContext.docSnippetsMap,
        changelogsMap: relatedContext.changelogsMap,
        geminiClient,
        log,
      });
    } catch (error) {
      log.error('翻訳処理に失敗しました', { error: toError(error) });
      process.exit(1);
    }
  }

  const writtenCount = await writeSettingEntryFiles({
    outputDir: OUTPUT_DIR,
    entries: newEntries,
    translationMap,
    ctx: relatedContext,
  });

  log.info(`完了: ${writtenCount}件のファイルを ${OUTPUT_DIR} に出力しました`);
}

main().catch((error) => {
  log.error('予期しないエラーが発生しました', { error: toError(error) });
  process.exit(1);
});
