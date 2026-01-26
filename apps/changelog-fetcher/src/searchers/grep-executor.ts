import { execSync } from 'node:child_process';
import * as path from 'node:path';
import type { Keywords } from '../schemas/analysis';
import type { SearchResult } from '../types';

// プロジェクトルート
const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

// ドキュメントディレクトリ（絶対パス）
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');
const EXCLUDED_FILE = 'changelog.md';

/**
 * 絶対パスをプロジェクトルートからの相対パスに変換
 */
function toRelativePath(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath);
}

/**
 * Grepコマンドを実行
 */
function executeGrep(pattern: string, flags: string): string[] {
  try {
    const command = `grep ${flags} '${pattern}' ${DOCS_DIR}/*.md`;
    const result = execSync(command, { encoding: 'utf-8' });
    return result
      .split('\n')
      .filter(Boolean)
      .filter((file) => !file.endsWith(EXCLUDED_FILE))
      .map(toRelativePath); // 相対パスに変換
  } catch (error) {
    // Grepが0件の場合、終了コード1でエラーになる
    if (error instanceof Error && 'status' in error && error.status === 1) {
      return [];
    }
    throw error; // その他のエラーは再スロー
  }
}

/**
 * 戦略1: バッククォート完全一致検索
 */
function exactSearch(keywords: string[]): string[] {
  if (keywords.length === 0) {
    return [];
  }

  const results = new Set<string>();

  for (const keyword of keywords) {
    const pattern = `\`${keyword}\``;
    const files = executeGrep(pattern, '-l -F');
    for (const file of files) {
      results.add(file);
    }
  }

  return Array.from(results);
}

/**
 * 戦略2: 正規化キーワード検索（大文字小文字無視）
 */
function normalizedSearch(keywords: string[]): string[] {
  if (keywords.length === 0) {
    return [];
  }

  const pattern = keywords.join('|');
  return executeGrep(pattern, '-l -iE');
}

/**
 * 戦略3: 複数キーワードOR検索
 */
function multiSearch(
  originalKeywords: string[],
  normalizedKeywords: string[],
): string[] {
  const allKeywords = [...originalKeywords, ...normalizedKeywords];
  if (allKeywords.length === 0) {
    return [];
  }

  const pattern = allKeywords.join('|');
  return executeGrep(pattern, '-l -iE');
}

/**
 * キーワードから関連ドキュメントを検索（フォールバック方式）
 */
export function searchDocs(keywords: Keywords): SearchResult {
  const { original, normalized } = keywords;

  // 戦略1: バッククォート完全一致
  const exactFiles = exactSearch(original);
  if (exactFiles.length > 0 && exactFiles.length <= 50) {
    return {
      files: exactFiles,
      strategy: 'exact',
    };
  }

  // 戦略2: 正規化キーワード
  const normalizedFiles = normalizedSearch(normalized);
  if (normalizedFiles.length > 0 && normalizedFiles.length <= 50) {
    return {
      files: normalizedFiles,
      strategy: 'normalized',
    };
  }

  // 戦略3: 複数キーワードOR検索
  const multiFiles = multiSearch(original, normalized);
  if (multiFiles.length > 0) {
    return {
      files: multiFiles,
      strategy: 'multi',
    };
  }

  // 0件
  return {
    files: [],
    strategy: 'multi',
  };
}

/**
 * タグによるスキップ判定
 */
export function shouldSkipSearch(tags: string[]): boolean {
  return tags.includes('SDK') || tags.includes('API');
}
