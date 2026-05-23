#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger } from '@claude-code-changelog-viewer/common';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'builtin-data');

const log = getLogger({ name: 'fetch-builtin-data' });

const MARCKRENN_URL =
  'https://raw.githubusercontent.com/marckrenn/claude-code-changelog/main/meta/cli-surface.md';
const PIEBALD_API_URL =
  'https://api.github.com/repos/Piebald-AI/claude-code-system-prompts/contents/system-prompts';

type GithubFile = { name: string; type: string };

function extractSection(markdown: string, sectionName: string): string[] {
  const lines = markdown.split('\n');
  const results: string[] = [];
  let inSection = false;
  let inSubSection = false;

  for (const line of lines) {
    // ## レベルのセクション開始
    if (line.startsWith('## ')) {
      inSection = line === `## ${sectionName}`;
      inSubSection = false;
      continue;
    }

    if (!inSection) {
      continue;
    }

    // ### レベルのサブセクション（Commands は ### Names のみ対象）
    if (line.startsWith('### ')) {
      inSubSection = sectionName === 'Commands' && line === '### Names';
      continue;
    }

    // Commands は ### Names サブセクション内のみ収集
    if (sectionName === 'Commands' && !inSubSection) {
      continue;
    }

    // - `item` 形式から抽出
    const match = line.match(/^- `([^`]+)`/);
    if (match?.[1]) {
      results.push(match[1]);
    }
  }

  return results;
}

async function fetchMarckrenn(): Promise<{
  tools: string[];
  commands: string[];
  skills: string[];
}> {
  log.info('marckrenn/claude-code-changelog から cli-surface.md を取得中...');
  const res = await fetch(MARCKRENN_URL);
  if (!res.ok) {
    throw new Error(`marckrenn fetch 失敗: ${res.status} ${res.statusText}`);
  }
  const markdown = await res.text();

  const tools = extractSection(markdown, 'Tools');
  const commands = extractSection(markdown, 'Commands');
  const skills = extractSection(markdown, 'Skills');

  log.info(
    `取得完了: tools=${tools.length}, commands=${commands.length}, skills=${skills.length}`,
  );
  return { tools, commands, skills };
}

async function fetchPiebaldAgents(): Promise<string[]> {
  log.info('Piebald-AI/claude-code-system-prompts からファイル一覧を取得中...');
  const res = await fetch(PIEBALD_API_URL, {
    headers: { 'User-Agent': 'claude-code-changelog-viewer' },
  });
  if (!res.ok) {
    throw new Error(`Piebald-AI fetch 失敗: ${res.status} ${res.statusText}`);
  }
  const files = (await res.json()) as GithubFile[];

  const agents = files
    .filter(
      (f) =>
        f.type === 'file' &&
        f.name.startsWith('agent-prompt-') &&
        f.name.endsWith('.md'),
    )
    .map((f) => f.name.replace(/^agent-prompt-/, '').replace(/\.md$/, ''));

  log.info(`取得完了: agents=${agents.length}`);
  return agents;
}

function writeJson(filename: string, data: string[]): void {
  const path = join(OUTPUT_DIR, filename);
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, 'utf-8');
  log.info(`書き込み完了: ${filename} (${data.length} 件)`);
}

async function main(): Promise<void> {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const [{ tools, commands, skills }, agents] = await Promise.all([
    fetchMarckrenn(),
    fetchPiebaldAgents(),
  ]);

  writeJson('tools.json', tools);
  writeJson('commands.json', commands);
  writeJson('skills.json', skills);
  writeJson('agents.json', agents);

  log.info('全ファイルの書き込みが完了しました');
}

main().catch((err) => {
  log.error('fetch-builtin-data 失敗', { error: err });
  process.exit(1);
});
