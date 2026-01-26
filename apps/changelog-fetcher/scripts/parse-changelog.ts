#!/usr/bin/env node
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

type Metadata = {
  lastFetchTime: string;
  versions: Record<string, string>;
  stats: {
    new: number;
    updated: number;
    unchanged: number;
  };
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
    currentVersion = match[1];
  }

  if (currentVersion) {
    versions[currentVersion] = lines.join('\n').trim();
  }

  return versions;
}

const appDir = join(__dirname, '..');
const outputDir = join(appDir, 'changelogs');
const metadataFile = join(appDir, 'metadata', 'last_fetch.json');

mkdirSync(outputDir, { recursive: true });
mkdirSync(dirname(metadataFile), { recursive: true });

console.log('Fetching CHANGELOG.md from anthropics/claude-code...');
const downloadUrl = execSync(
  'gh api repos/anthropics/claude-code/contents/CHANGELOG.md --jq .download_url',
  { encoding: 'utf-8' },
).trim();
const changelogContent = execSync(`curl -sL ${downloadUrl}`, {
  encoding: 'utf-8',
});

console.log('Processing changelog entries...');
const versions = parseChangelog(changelogContent);

const existingMetadata = existsSync(metadataFile)
  ? (JSON.parse(readFileSync(metadataFile, 'utf-8')) as Metadata).versions
  : {};

let newCount = 0;
let updatedCount = 0;
let unchangedCount = 0;
const newMetadata: Record<string, string> = {};

for (const [version, content] of Object.entries(versions)) {
  const versionKey = `v${version}`;
  const contentHash = createHash('sha256')
    .update(content, 'utf-8')
    .digest('hex');
  const versionFile = join(outputDir, `${versionKey}.md`);
  const existingHash = existingMetadata[versionKey] ?? '';

  if (contentHash === existingHash && existsSync(versionFile)) {
    console.log(`  → ${versionKey}: Unchanged`);
    unchangedCount++;
    newMetadata[versionKey] = contentHash;
    continue;
  }

  writeFileSync(versionFile, `## ${version}\n\n${content}\n`, 'utf-8');

  if (existingHash) {
    console.log(`  ✓ ${versionKey}: Updated`);
    updatedCount++;
  } else {
    console.log(`  ✓ ${versionKey}: New`);
    newCount++;
  }

  newMetadata[versionKey] = contentHash;
}

const metadata: Metadata = {
  lastFetchTime: new Date().toISOString(),
  versions: newMetadata,
  stats: { new: newCount, updated: updatedCount, unchanged: unchangedCount },
};

writeFileSync(metadataFile, JSON.stringify(metadata, null, 2), 'utf-8');

console.log();
console.log('✓ Fetch completed:');
console.log(`  - New: ${newCount}`);
console.log(`  - Updated: ${updatedCount}`);
console.log(`  - Unchanged: ${unchangedCount}`);
