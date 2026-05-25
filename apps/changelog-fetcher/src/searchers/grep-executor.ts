import * as fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import * as path from 'node:path';
import type { Keywords, SearchResult } from '../types';
import { escapeRegex } from './escape-regex';
import { PROJECT_ROOT, toRelativePath } from './paths';

// ドキュメントディレクトリ(絶対パス)
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');
const EXCLUDED_FILE = 'changelog.md';

/**
 * ドキュメントディレクトリから .md ファイル一覧を取得
 */
function getMdFiles(docsDir: string): string[] {
  return Array.from(globSync('*.md', { cwd: docsDir }))
    .map(String)
    .filter((file) => file !== EXCLUDED_FILE)
    .map((file) => path.join(docsDir, file));
}

/**
 * ファイル一覧を並行読み込みしてキャッシュを構築
 */
async function loadFileContents(files: string[]): Promise<Map<string, string>> {
  const entries = await Promise.all(
    files.map(async (file) => {
      const content = await fs.readFile(file, 'utf8');
      return [file, content] as const;
    }),
  );
  return new Map(entries);
}

/**
 * バッククォート完全一致検索
 */
function exactSearch(keywords: string[], cache: Map<string, string>): string[] {
  if (keywords.length === 0) {
    return [];
  }

  const results = new Set<string>();
  for (const [file, content] of cache) {
    for (const keyword of keywords) {
      if (content.includes(`\`${keyword}\``)) {
        results.add(toRelativePath(file));
        break;
      }
    }
  }
  return Array.from(results);
}

/**
 * 正規表現でファイルを検索
 */
function regexSearch(keywords: string[], cache: Map<string, string>): string[] {
  if (keywords.length === 0) {
    return [];
  }

  const escapedKeywords = keywords.map(escapeRegex);
  const pattern = new RegExp(escapedKeywords.join('|'), 'i');
  const matched: string[] = [];
  for (const [file, content] of cache) {
    if (pattern.test(content)) {
      matched.push(toRelativePath(file));
    }
  }
  return matched;
}

/**
 * キーワードから関連ドキュメントを検索(フォールバック方式)
 */
export async function searchDocs(
  keywords: Keywords,
  docsDir = DOCS_DIR,
): Promise<SearchResult> {
  const { original, normalized } = keywords;
  const files = getMdFiles(docsDir);
  const cache = await loadFileContents(files);

  // バッククォート完全一致
  const exactFiles = exactSearch(original, cache);
  if (exactFiles.length > 0 && exactFiles.length <= 50) {
    return { files: exactFiles };
  }

  // 正規化キーワード
  const normalizedFiles = regexSearch(normalized, cache);
  if (normalizedFiles.length > 0 && normalizedFiles.length <= 50) {
    return { files: normalizedFiles };
  }

  // 複数キーワードOR検索(上限50件)
  const multiFiles = regexSearch([...original, ...normalized], cache);
  return { files: multiFiles.slice(0, 50) };
}
