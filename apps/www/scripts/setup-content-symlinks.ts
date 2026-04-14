import { mkdir, readdir, readlink, symlink, unlink } from 'node:fs/promises';
import { join, relative } from 'node:path';

const FETCHER_DIR = join(process.cwd(), '..', 'changelog-fetcher');
const DOCS_TRACKER_DIR = join(process.cwd(), '..', 'docs-tracker');

const CHANGELOG_SRC = join(FETCHER_DIR, 'inferred');
const CHANGELOG_DEST = join(process.cwd(), 'src', 'content', 'changelog');

const DIFF_SRC = join(FETCHER_DIR, 'diff', 'changelog_diff.json');
const DIFF_DEST_DIR = join(process.cwd(), 'src', 'content', 'diff');
const DIFF_DEST = join(DIFF_DEST_DIR, 'changelog_diff.json');

const DOCS_DIFF_SRC = join(DOCS_TRACKER_DIR, 'diffs');
const DOCS_DIFF_DEST = join(process.cwd(), 'src', 'content', 'docs-diff');

// バージョン JSON を changelog-fetcher/inferred/ からシンボリックリンクで展開する
async function linkVersionFiles(): Promise<void> {
  await mkdir(CHANGELOG_DEST, { recursive: true });

  // 既存のシンボリックリンクを全削除
  const existing = await readdir(CHANGELOG_DEST).catch(() => [] as string[]);
  for (const file of existing) {
    const filePath = join(CHANGELOG_DEST, file);
    try {
      await readlink(filePath);
      await unlink(filePath);
      console.log(`削除: ${file}`);
    } catch {
      // シンボリックリンクでないファイルはスキップ
    }
  }

  // inferred_vX.Y.Z.json → vX.Y.Z.json としてリンク
  const files = await readdir(CHANGELOG_SRC);

  for (const file of files) {
    if (file.startsWith('inferred_v') && file.endsWith('.json')) {
      const version = file.replace('inferred_v', '').replace('.json', '');
      const src = join(CHANGELOG_SRC, file);
      const dest = join(CHANGELOG_DEST, `v${version}.json`);
      await symlink(relative(CHANGELOG_DEST, src), dest);
      console.log(`v${version}.json -> ${file}`);
    }
  }
}

// 単一ファイルをシンボリックリンクで配置する
async function linkFile(
  src: string,
  destDir: string,
  dest: string,
): Promise<void> {
  await mkdir(destDir, { recursive: true });

  try {
    await readlink(dest);
    await unlink(dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }

  try {
    await symlink(relative(destDir, src), dest);
    console.log(
      `${relative(process.cwd(), dest)} -> ${relative(process.cwd(), src)}`,
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`ソースが存在しません: ${relative(process.cwd(), src)}`);
    } else {
      throw e;
    }
  }
}

// ディレクトリ全体をシンボリックリンクで配置する
async function linkDirectory(src: string, dest: string): Promise<void> {
  // 既存のリンク or ディレクトリを削除
  try {
    await readlink(dest);
    await unlink(dest);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw e;
    }
  }

  try {
    await symlink(relative(join(dest, '..'), src), dest);
    console.log(
      `${relative(process.cwd(), dest)} -> ${relative(process.cwd(), src)}`,
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      console.log(`ソースが存在しません: ${relative(process.cwd(), src)}`);
    } else {
      throw e;
    }
  }
}

await linkVersionFiles();
await linkFile(DIFF_SRC, DIFF_DEST_DIR, DIFF_DEST);
await linkDirectory(DOCS_DIFF_SRC, DOCS_DIFF_DEST);
