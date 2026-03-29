#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import type { ChangelogDiff, DiffEvent } from './types';

const __dirname = dirname(fileURLToPath(import.meta.url));

const log = getLogger({ name: 'changelog-fetcher' });

type Metadata = {
  lastFetchTime: string;
  versions: Record<string, string>;
};

export function parseChangelog(content: string): Record<string, string> {
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

export function extractItems(content: string): string[] {
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '));
}

export function loadDiffFile(filePath: string): ChangelogDiff {
  if (!existsSync(filePath)) {
    return { events: [] };
  }
  return JSON.parse(readFileSync(filePath, 'utf-8')) as ChangelogDiff;
}

export function saveDiffFile(filePath: string, data: ChangelogDiff): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function isDuplicateEvent(
  events: DiffEvent[],
  candidate: Pick<
    DiffEvent,
    'version' | 'type' | 'items_added' | 'items_removed'
  >,
): boolean {
  const candidateAddedSet = new Set(candidate.items_added);
  const candidateRemovedSet = new Set(candidate.items_removed);
  return events.some(
    (e) =>
      e.version === candidate.version &&
      e.type === candidate.type &&
      e.items_added.length === candidate.items_added.length &&
      e.items_removed.length === candidate.items_removed.length &&
      e.items_added.every((item) => candidateAddedSet.has(item)) &&
      e.items_removed.every((item) => candidateRemovedSet.has(item)),
  );
}

function main() {
  const appDir = join(__dirname, '..');
  const outputDir = join(appDir, 'changelogs');
  const metadataFile = join(appDir, 'metadata', 'last_fetch.json');
  const diffFile = join(appDir, 'diff', 'changelog_diff.json');

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

  const diffData = loadDiffFile(diffFile);

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

    // 項目差分の検知(ハッシュ不一致かつローカルファイルが存在する場合)
    if (contentHash !== existingHash && existsSync(versionFile)) {
      const remoteItems = extractItems(content);
      const localContent = readFileSync(versionFile, 'utf-8');
      const localItems = extractItems(localContent);

      const remoteSet = new Set(remoteItems);
      const localSet = new Set(localItems);
      const added = remoteItems.filter((item) => !localSet.has(item));
      const removed = localItems.filter((item) => !remoteSet.has(item));

      if (added.length > 0 || removed.length > 0) {
        const event = {
          version: versionKey,
          type: 'items_changed' as const,
          items_added: added,
          items_removed: removed,
        };
        if (!isDuplicateEvent(diffData.events, event)) {
          diffData.events.push({
            detected_at: new Date().toISOString(),
            ...event,
          });
          log.msg('APLG0007', { params: [`${versionKey} の項目差分`] });
        }
      }
    }

    if (contentHash === existingHash && existsSync(versionFile)) {
      log.debug(`${versionKey}: 変更なし`);
      newMetadata[versionKey] = contentHash;
      continue;
    }

    writeFileSync(versionFile, `## ${version}\n\n${content}\n`, 'utf-8');

    if (existingHash) {
      log.info(`${versionKey}: 更新あり`);
      updatedCount += 1;
    } else {
      log.info(`${versionKey}: 新規`);
      newCount += 1;
    }

    newMetadata[versionKey] = contentHash;
  }

  // バージョン削除検知
  for (const metadataVersionKey of Object.keys(existingMetadata)) {
    const versionNumber = metadataVersionKey.replace(/^v/, '');
    if (!(versionNumber in versions)) {
      const event = {
        version: metadataVersionKey,
        type: 'version_removed' as const,
        items_added: [] as string[],
        items_removed: [] as string[],
      };
      if (!isDuplicateEvent(diffData.events, event)) {
        diffData.events.push({
          detected_at: new Date().toISOString(),
          ...event,
        });
        log.msg('APLG0010', { params: [`${metadataVersionKey} の削除`] });
      }
    }
  }

  saveDiffFile(diffFile, diffData);

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

if (import.meta.main) {
  try {
    main();
  } catch (error) {
    log.msg('APLG0018', { error: toError(error) });
    process.exit(2);
  }
}
