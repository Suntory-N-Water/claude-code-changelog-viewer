import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns/format';

const execFileAsync = promisify(execFile);

const COLUMN_DIR = fileURLToPath(
  new URL('../src/content/posts/column/', import.meta.url),
);
// content.config.ts の columnCollection と同じ制約
const SLUG_PATTERN = /^[a-z0-9-]+$/;

async function createBranch(slug: string): Promise<void> {
  const branch = `feat/column-${slug}`;
  try {
    await execFileAsync('git', ['rev-parse', '--verify', branch]);
    console.log(`⚠️  ブランチ "${branch}" は既に存在するため切り替えません\n`);
    return;
  } catch {
    // 存在しないので新規作成する
  }

  try {
    await execFileAsync('git', ['checkout', '-b', branch]);
    console.log(`🌿 ブランチを作成しました: ${branch}\n`);
  } catch (error) {
    console.error('⚠️  ブランチの作成に失敗しました');
    console.error(
      `   ${error instanceof Error ? error.message : String(error)}`,
    );
    console.error('   手動でブランチを作成してください\n');
  }
}

async function main(): Promise<void> {
  const slug = process.argv[2];

  if (!slug) {
    console.error('❌ slug を指定してください\n');
    console.error('使用方法:');
    console.error('  pnpm run new-column <slug>\n');
    console.error('例:');
    console.error('  pnpm run new-column claude-code-hooks-tips');
    process.exit(1);
  }

  if (!SLUG_PATTERN.test(slug)) {
    console.error('❌ slug は英小文字・数字・ハイフン(-)のみ使用できます');
    console.error(`   不正な値: "${slug}"`);
    process.exit(1);
  }

  const filePath = join(COLUMN_DIR, `${slug}.md`);
  if (existsSync(filePath)) {
    console.error(`❌ 記事が既に存在します: ${slug}.md`);
    process.exit(1);
  }

  const today = format(new TZDate(Date.now(), 'Asia/Tokyo'), 'yyyy-MM-dd');
  // クォートを外すと YAML が Date オブジェクトとして解釈し、schema の z.string() を通らない
  const template = `---
title:
slug: ${slug}
date: "${today}"
modified_time:
description:
---

`;

  await mkdir(COLUMN_DIR, { recursive: true });
  await writeFile(filePath, template, 'utf-8');

  await createBranch(slug);

  console.log('✅ コラムのテンプレートを作成しました\n');
  console.log(`📝 ファイル: ${filePath}`);
  console.log(`🔗 公開 URL: /posts/column/${slug}\n`);
  console.log('次のステップ:');
  console.log('  1. title と description を記入');
  console.log('  2. 本文を執筆(画像は同じディレクトリに置いて相対パスで貼る)');
  console.log('  3. 公開前に /column-image-upload で画像を R2 に上げる');
  console.log('  4. 更新日を出したくなったら modified_time に日付を入れる');
}

main().catch((error) => {
  console.error('エラーが発生しました:', error);
  process.exit(1);
});
