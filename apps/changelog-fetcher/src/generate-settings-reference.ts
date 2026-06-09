import * as path from 'node:path';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { generateSettingsReference } from './application/generate-settings-reference';
import { GeminiSettingsTranslator } from './infrastructure/ai/gemini-settings-translator';
import { PROJECT_ROOT } from './infrastructure/docs/docs-paths';
import {
  loadExistingSettingKeys,
  writeSettingReferenceFiles,
} from './infrastructure/filesystem/settings-entry-writer';
import { loadSettingsEntries } from './infrastructure/settings-reference/settings-entry-loader';
import { loadSettingsReferenceContext } from './infrastructure/settings-reference/settings-related-context';

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
const INFERRED_DIR = path.join(process.cwd(), 'inferred');
const OUTPUT_DIR = path.join(process.cwd(), 'settings');

async function main() {
  const noAiMode = process.env['SETTINGS_NO_AI'] === '1';
  log.info(`設定・環境変数リファレンス生成を開始 (AIモード: ${!noAiMode})`);

  const apiKey = process.env['GEMINI_API_KEY'];
  if (!noAiMode && !apiKey) {
    log.error('GEMINI_API_KEY 環境変数が設定されていません');
    process.exit(1);
  }

  const writtenCount = await generateSettingsReference({
    noAiMode,
    paths: {
      schemaPath: SCHEMA_PATH,
      envVarsMdPath: ENV_VARS_MD_PATH,
      docsEnDir: DOCS_EN_DIR,
      inferredDir: INFERRED_DIR,
      outputDir: OUTPUT_DIR,
    },
    settingsEntrySource: { load: loadSettingsEntries },
    relatedContextSource: { load: loadSettingsReferenceContext },
    settingsReferenceStore: {
      loadExistingKeys: loadExistingSettingKeys,
      writeReferences: writeSettingReferenceFiles,
    },
    ...(apiKey
      ? { settingsTranslator: new GeminiSettingsTranslator(apiKey, log) }
      : {}),
    log,
  });

  log.info(`完了: ${writtenCount}件のファイルを ${OUTPUT_DIR} に出力しました`);
}

main().catch((error) => {
  log.error('予期しないエラーが発生しました', { error: toError(error) });
  process.exit(1);
});
