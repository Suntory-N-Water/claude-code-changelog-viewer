#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { z } from 'zod';
import { GeminiClient } from './infrastructure/ai/gemini-client';
import { IssuesCorpusStore } from './infrastructure/filesystem/issues-corpus-store';
import { createTiedFileStore } from './infrastructure/filesystem/tied-store';
import { toChangelogAnalysis } from './infrastructure/serializers/analysis-serializer';
import { buildStrongTokenDictionary } from './domain/tie-issue/strong-token-dictionary';
import type { IssueEmbedding } from './domain/tie-issue/cosine';
import { tieIssues } from './usecase/tie-issues';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');

const log = getLogger({ name: 'tie-issue' });

function requireVersion(): string {
  const v = process.argv[2];
  if (!v) {
    log.error('Usage: tsx src/tie-issue.ts <version>');
    process.exit(1);
  }
  return v;
}
const version = requireVersion();

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    log.error(`${name} が設定されていません`);
    process.exit(1);
  }
  return v;
}
const apiKey = requireEnv('GEMINI_API_KEY');

const analysisPath = join(APP_DIR, 'analysis', `analysis_${version}.json`);
if (!existsSync(analysisPath)) {
  log.error(`analysis ファイルが存在しません: ${analysisPath}`);
  process.exit(1);
}

const corpusDir = join(APP_DIR, 'issues-corpus');
const embeddingsPath = join(APP_DIR, 'issues-embeddings', 'embeddings.jsonl');
if (!existsSync(corpusDir) || !existsSync(embeddingsPath)) {
  log.warn(
    `issue コーパスが未整備のため tie-issue を skip する corpus=${existsSync(corpusDir)} embeddings=${existsSync(embeddingsPath)}`,
  );
  process.exit(0);
}

const EmbeddingRecordSchema = z.object({
  number: z.number().int().positive(),
  embedded_at: z.string(),
  embedding: z.array(z.number()),
});

const StringArraySchema = z.array(z.string());
const ManualTokensSchema = z.object({ tokens: z.array(z.string()) });
const DenylistSchema = z.object({
  envs: z.array(z.string()),
  tools: z.array(z.string()),
});
const SettingsFileSchema = z.object({
  key: z.string(),
  leaf_name: z.string(),
  slug: z.string(),
});

async function loadStringArray(path: string): Promise<string[]> {
  if (!existsSync(path)) {
    return [];
  }
  const raw = await readFile(path, 'utf-8');
  return StringArraySchema.parse(JSON.parse(raw));
}

async function loadIssueEmbeddings(): Promise<IssueEmbedding[]> {
  const raw = await readFile(embeddingsPath, 'utf-8');
  const embeddings: IssueEmbedding[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const record = EmbeddingRecordSchema.parse(JSON.parse(trimmed));
    embeddings.push({ number: record.number, embedding: record.embedding });
  }
  return embeddings;
}

async function loadSettingsTokens(): Promise<{
  keys: string[];
  slugs: string[];
  leafNames: string[];
}> {
  const settingsDir = join(APP_DIR, 'settings');
  if (!existsSync(settingsDir)) {
    return { keys: [], slugs: [], leafNames: [] };
  }
  const files = (await readdir(settingsDir)).filter((n) =>
    n.startsWith('settings_'),
  );
  const keys: string[] = [];
  const slugs: string[] = [];
  const leafNames: string[] = [];
  for (const name of files) {
    const raw = await readFile(join(settingsDir, name), 'utf-8');
    const parsed = JSON.parse(raw);
    const result = SettingsFileSchema.safeParse(parsed);
    if (!result.success) {
      continue;
    }
    keys.push(result.data.key);
    slugs.push(result.data.slug);
    leafNames.push(result.data.leaf_name);
  }
  return { keys, slugs, leafNames };
}

async function main(): Promise<void> {
  log.info(`analysis 読込: ${analysisPath}`);
  const analysisRaw = await readFile(analysisPath, 'utf-8');
  const analysisJson = AnalysisSchema.parse(JSON.parse(analysisRaw));
  const analysis = toChangelogAnalysis(analysisJson);

  const [envs, commands, tools, agents, skills, settingsTokens] =
    await Promise.all([
      loadStringArray(join(APP_DIR, 'builtin-data', 'envs.json')),
      loadStringArray(join(APP_DIR, 'builtin-data', 'commands.json')),
      loadStringArray(join(APP_DIR, 'builtin-data', 'tools.json')),
      loadStringArray(join(APP_DIR, 'builtin-data', 'agents.json')),
      loadStringArray(join(APP_DIR, 'builtin-data', 'skills.json')),
      loadSettingsTokens(),
    ]);

  const tiePolicyDir = join(APP_DIR, 'tie-issue');
  const denylistRaw = await readFile(
    join(tiePolicyDir, 'denylist.json'),
    'utf-8',
  );
  const denylist = DenylistSchema.parse(JSON.parse(denylistRaw));
  const manualRaw = await readFile(
    join(tiePolicyDir, 'manual-tokens.json'),
    'utf-8',
  );
  const manual = ManualTokensSchema.parse(JSON.parse(manualRaw));

  const dictionary = buildStrongTokenDictionary({
    envs,
    commands,
    tools,
    agents,
    skills,
    settingsKeys: settingsTokens.keys,
    settingsSlugs: settingsTokens.slugs,
    settingsLeafNames: settingsTokens.leafNames,
    manualTokens: manual.tokens,
    envDenylist: denylist.envs,
    toolDenylist: denylist.tools,
  });

  const issueEmbeddings = await loadIssueEmbeddings();
  log.info(
    `辞書サイズ: envs=${dictionary.envs.size} commands=${dictionary.commands.size} identifiers=${dictionary.identifiers.size} settings=${dictionary.settingsTokens.size} manual=${dictionary.manualTokens.size}`,
  );
  log.info(`issue embeddings 読込: ${issueEmbeddings.length}件`);

  const corpus = new IssuesCorpusStore({
    corpusDir,
    metadataPath: join(APP_DIR, 'metadata', 'issues-fetch.json'),
  });

  const gemini = new GeminiClient(apiKey, log.child({ component: 'gemini' }));

  const tied = await tieIssues({
    analysis,
    corpus: {
      loadEntry: (n) => corpus.loadEntry(n),
      listStoredNumbers: () => corpus.listStoredNumbers(),
    },
    issueEmbeddings,
    embed: gemini,
    dictionary,
    logger: log,
  });

  const tiedStore = createTiedFileStore(APP_DIR);
  await tiedStore.save(tied, version);
  log.info(`tied 保存完了: tied/tied_${version}.json`);
}

main().catch((error) => {
  log.error('tie-issue 失敗', { error: toError(error) });
  process.exit(1);
});
