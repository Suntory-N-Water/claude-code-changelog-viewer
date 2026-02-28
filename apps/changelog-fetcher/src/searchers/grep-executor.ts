import * as path from 'node:path';
import type { Keywords, SearchResult } from '../types';

// プロジェクトルート
const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

// ドキュメントディレクトリ(絶対パス)
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');
const EXCLUDED_FILE = 'changelog.md';

/**
 * 絶対パスをプロジェクトルートからの相対パスに変換
 */
function toRelativePath(absolutePath: string): string {
  return path.relative(PROJECT_ROOT, absolutePath);
}

/**
 * ドキュメントディレクトリから .md ファイル一覧を取得
 */
function getMdFiles(docsDir: string): string[] {
  const glob = new Bun.Glob('*.md');
  return Array.from(glob.scanSync(docsDir))
    .filter((file) => file !== EXCLUDED_FILE)
    .map((file) => path.join(docsDir, file));
}

/**
 * 戦略1: バッククォート完全一致検索
 */
async function exactSearch(
  keywords: string[],
  files: string[],
): Promise<string[]> {
  if (keywords.length === 0) {
    return [];
  }

  const results = new Set<string>();
  for (const file of files) {
    const content = await Bun.file(file).text();
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
 * 正規表現でファイルを検索(戦略2, 3 共通)
 */
async function regexSearch(
  keywords: string[],
  files: string[],
): Promise<string[]> {
  if (keywords.length === 0) {
    return [];
  }

  const pattern = new RegExp(keywords.join('|'), 'i');
  const matched: string[] = [];
  for (const file of files) {
    const content = await Bun.file(file).text();
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

  // 戦略1: バッククォート完全一致
  const exactFiles = await exactSearch(original, files);
  if (exactFiles.length > 0 && exactFiles.length <= 50) {
    return { files: exactFiles };
  }

  // 戦略2: 正規化キーワード
  const normalizedFiles = await regexSearch(normalized, files);
  if (normalizedFiles.length > 0 && normalizedFiles.length <= 50) {
    return { files: normalizedFiles };
  }

  // 戦略3: 複数キーワードOR検索
  const multiFiles = await regexSearch([...original, ...normalized], files);
  return { files: multiFiles };
}
