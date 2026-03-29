import { mkdir, readdir, readlink, symlink, unlink } from 'node:fs/promises';
import { join, relative } from 'node:path';

const FETCHER_DIR = join(process.cwd(), '..', 'changelog-fetcher');
const INFERRED_DIR = join(FETCHER_DIR, 'inferred');
const CONTENT_DIR = join(process.cwd(), 'src', 'content', 'changelog');
const DIFF_SOURCE = join(FETCHER_DIR, 'diff', 'changelog_diff.json');
const DIFF_DIR = join(process.cwd(), 'src', 'content', 'diff');
const DOCS_TRACKER_DIR = join(process.cwd(), '..', 'docs-tracker');
const DOCS_DIFF_SOURCE = join(DOCS_TRACKER_DIR, 'diffs', 'docs_diff.json');
const DOCS_DIFF_DIR = join(process.cwd(), 'src', 'content', 'docs-diff');

// ディレクトリ作成
try {
  await mkdir(CONTENT_DIR, { recursive: true });
} catch {}

// 既存のシンボリックリンクを全削除
const existingFiles = await readdir(CONTENT_DIR).catch(() => []);
for (const file of existingFiles) {
  const filePath = join(CONTENT_DIR, file);
  try {
    await readlink(filePath); // シンボリックリンクかチェック
    await unlink(filePath);
    console.log(`Removed old symlink: ${file}`);
  } catch {
    // シンボリックリンクでない場合はスキップ
  }
}

// inferred/ の全JSONをシンボリックリンク
const files = await readdir(INFERRED_DIR);
let count = 0;

for (const file of files) {
  if (file.startsWith('inferred_v') && file.endsWith('.json')) {
    const version = file.replace('inferred_v', '').replace('.json', '');
    const targetPath = join(INFERRED_DIR, file);
    const linkPath = join(CONTENT_DIR, `v${version}.json`);

    // 相対パスでシンボリックリンク作成
    const relativePath = relative(CONTENT_DIR, targetPath);
    await symlink(relativePath, linkPath);

    console.log(`✓ Linked: v${version}.json -> ${file}`);
    count += 1;
  }
}

console.log(`\nTotal: ${count} versions synced`);

// diff/changelog_diff.json のシンボリックリンク
try {
  await mkdir(DIFF_DIR, { recursive: true });
} catch {}

const diffLinkPath = join(DIFF_DIR, 'changelog_diff.json');

// 既存リンクがあれば削除
try {
  await readlink(diffLinkPath);
  await unlink(diffLinkPath);
} catch {}

// シンボリックリンク作成(ソースが存在しない場合は symlink が失敗する)
try {
  const diffRelativePath = relative(DIFF_DIR, DIFF_SOURCE);
  await symlink(diffRelativePath, diffLinkPath);
  console.log(`✓ Linked: changelog_diff.json -> ${diffRelativePath}`);
} catch {
  console.log('⊘ diff/changelog_diff.json not found, skipping');
}

// docs_diff.json のシンボリックリンク
try {
  await mkdir(DOCS_DIFF_DIR, { recursive: true });
} catch {}

const docsDiffLinkPath = join(DOCS_DIFF_DIR, 'docs_diff.json');

try {
  await readlink(docsDiffLinkPath);
  await unlink(docsDiffLinkPath);
} catch {}

try {
  const docsDiffRelativePath = relative(DOCS_DIFF_DIR, DOCS_DIFF_SOURCE);
  await symlink(docsDiffRelativePath, docsDiffLinkPath);
  console.log(`✓ Linked: docs_diff.json -> ${docsDiffRelativePath}`);
} catch {
  console.log('⊘ diffs/docs_diff.json not found, skipping');
}
