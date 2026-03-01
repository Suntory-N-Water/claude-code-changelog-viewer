#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = getLogger({ name: 'changelog-fetcher' });

type Metadata = {
  lastFetchTime: string;
  versions: Record<string, string>;
};

function parseChangelog(content: string): Record<string, string> {
  const versions: Record<string, string> = {};
  let currentVersion: string | null = null;
  const lines: string[] = [];

  for (const line of content.split('\n')) {
    const match = line.match(/^## (\d+\.\d+\.\d+)/);

    if (!match) {
      if (currentVersion) {
        lines.push(line);
      }
      continue;
    }

    if (currentVersion) {
      versions[currentVersion] = lines.join('\n').trim();
      lines.length = 0;
    }
    currentVersion = match[1] ?? null;
  }

  if (currentVersion) {
    versions[currentVersion] = lines.join('\n').trim();
  }

  return versions;
}

function main() {
  const appDir = join(__dirname, '..');
  const outputDir = join(appDir, 'changelogs');
  const metadataFile = join(appDir, 'metadata', 'last_fetch.json');

  mkdirSync(outputDir, { recursive: true });
  mkdirSync(dirname(metadataFile), { recursive: true });

  log.msg('APLG0003', { params: ['CHANGELOG.md'] });
  const downloadUrl = execSync(
    'gh api repos/anthropics/claude-code/contents/CHANGELOG.md --jq .download_url',
    { encoding: 'utf-8' },
  ).trim();
  const changelogContent = execSync(`curl -sL ${downloadUrl}`, {
    encoding: 'utf-8',
  });

  log.msg('APLG0020', { params: ['CHANGELOG エントリー'] });
  const versions = parseChangelog(changelogContent);

  const existingMetadata = existsSync(metadataFile)
    ? (JSON.parse(readFileSync(metadataFile, 'utf-8')) as Metadata).versions
    : {};

  let newCount = 0;
  let updatedCount = 0;
  const newMetadata: Record<string, string> = {};

  for (const [version, content] of Object.entries(versions)) {
    const versionKey = `v${version}`;
    const contentHash = createHash('sha256')
      .update(content, 'utf-8')
      .digest('hex');
    const versionFile = join(outputDir, `${versionKey}.md`);
    const existingHash = existingMetadata[versionKey] ?? '';

    if (contentHash === existingHash && existsSync(versionFile)) {
      log.debug(`${versionKey}: 変更なし`);
      newMetadata[versionKey] = contentHash;
      continue;
    }

    writeFileSync(versionFile, `## ${version}\n\n${content}\n`, 'utf-8');

    if (existingHash) {
      log.info(`${versionKey}: 更新あり`);
      updatedCount++;
    } else {
      log.info(`${versionKey}: 新規`);
      newCount++;
    }

    newMetadata[versionKey] = contentHash;
  }

  const metadata: Metadata = {
    lastFetchTime: new Date().toISOString(),
    versions: newMetadata,
  };

  writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

  log.msg('APLG0002', { params: ['CHANGELOG の取得'] });

  // 更新がない場合は exit 1 を返す
  if (newCount === 0 && updatedCount === 0) {
    log.msg('APLG0008', { params: ['CHANGELOG'] });
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  log.msg('APLG0018', { error: toError(error) });
  process.exit(2);
}
