import { execSync } from 'node:child_process';
import * as path from 'node:path';
import type { Keywords } from '@claude-code-changelog-viewer/types';
import type { SnippetResult } from '../types';

const MAX_SNIPPETS_PER_FILE = 5;

/**
 * 正規表現メタ文字をエスケープ
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// プロジェクトルート
const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

/**
 * 相対パスを絶対パスに変換
 */
function toAbsolutePath(relativePath: string): string {
  return path.join(PROJECT_ROOT, relativePath);
}

/**
 * ファイル内のキーワードマッチ数をカウント
 */
function countMatches(file: string, keywords: Keywords): number {
  const { original, normalized } = keywords;
  const allKeywords = [...original, ...normalized];

  if (allKeywords.length === 0) {
    return 0;
  }

  try {
    const pattern = allKeywords.map(escapeRegex).join('|');
    const absolutePath = toAbsolutePath(file);
    const command = `grep -c -iE '(${pattern})' "${absolutePath}"`;
    const result = execSync(command, { encoding: 'utf-8' });
    return Number.parseInt(result.trim(), 10) || 0;
  } catch (error) {
    // マッチなしの場合は終了コード1
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return 0;
    }
    throw error;
  }
}

/**
 * ファイルからスニペットを抽出(前後3行)
 */
function extractSnippetsFromFile(file: string, keywords: Keywords): string[] {
  const { original, normalized } = keywords;
  const allKeywords = [...original, ...normalized];

  if (allKeywords.length === 0) {
    return [];
  }

  try {
    const pattern = allKeywords.map(escapeRegex).join('|');
    const absolutePath = toAbsolutePath(file);
    const command = `grep -iE '(${pattern})' -B 3 -A 3 "${absolutePath}"`;
    const result = execSync(command, { encoding: 'utf-8' });

    // 区切り線 "--" でスニペットを分割
    const snippets = result
      .split('--\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_SNIPPETS_PER_FILE); // 上限5件

    return snippets;
  } catch (error) {
    // マッチなしの場合は終了コード1
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return [];
    }
    throw error;
  }
}

/**
 * ファイルリストからスニペットを抽出
 */
export function extractSnippets(
  files: string[],
  keywords: Keywords,
): SnippetResult[] {
  return files.map((file) => {
    const hit_count = countMatches(file, keywords);
    const snippets = extractSnippetsFromFile(file, keywords);

    return {
      file,
      snippets,
      hit_count,
    };
  });
}
