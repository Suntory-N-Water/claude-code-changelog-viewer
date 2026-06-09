import * as fs from 'node:fs/promises';
import { globSync } from 'node:fs';
import * as path from 'node:path';
import { normalizeMarkdownForAi } from '@claude-code-changelog-viewer/common';
import type { KeywordSet } from '../../domain/analysis/keyword-set';
import type { ChangelogEntry } from '../../domain/changelog/changelog-entry';
import type { RelatedDoc } from '../../domain/analysis/related-doc';
import { escapeRegex } from './escape-regex';
import { PROJECT_ROOT, toAbsolutePath, toRelativePath } from './docs-paths';
import { extractKeywords } from './keyword-extractor';

export type SearchResult = {
  files: string[];
};

export type SnippetResult = {
  file: string;
  snippets: string[];
  hit_count: number;
};

// ドキュメントディレクトリ(絶対パス)
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');
const EXCLUDED_FILE = 'changelog.md';
const MAX_SNIPPETS_PER_FILE = 5;

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
  keywords: KeywordSet,
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

/**
 * ファイルを解析してマッチ行数とスニペットを返す
 */
async function analyzeFile(
  absolutePath: string,
  pattern: RegExp,
): Promise<{ hit_count: number; snippets: string[] }> {
  const content = await fs.readFile(absolutePath, 'utf8');
  const lines = content.split('\n');

  // マッチ行のインデックスを収集
  const matchIndices: number[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (line && pattern.test(line)) {
      matchIndices.push(i);
    }
  }

  if (matchIndices.length === 0) {
    return { hit_count: 0, snippets: [] };
  }

  // 前後3行を含むブロックを構築し、隣接ブロックをマージ
  const blocks: { start: number; end: number }[] = [];
  for (const idx of matchIndices) {
    const start = Math.max(0, idx - 3);
    const end = Math.min(lines.length - 1, idx + 3);

    const lastBlock = blocks.at(-1);
    if (lastBlock && start <= lastBlock.end + 1) {
      lastBlock.end = end;
    } else {
      blocks.push({ start, end });
    }
  }

  const snippets = blocks
    .map((b) => lines.slice(b.start, b.end + 1).join('\n'))
    .slice(0, MAX_SNIPPETS_PER_FILE);

  return { hit_count: matchIndices.length, snippets };
}

/**
 * ファイルリストからスニペットを抽出
 */
export async function extractSnippets(
  files: string[],
  keywords: KeywordSet,
): Promise<SnippetResult[]> {
  const allKeywords = [
    ...new Set([...keywords.original, ...keywords.normalized]),
  ];
  if (allKeywords.length === 0) {
    return files.map((file) => ({ file, snippets: [], hit_count: 0 }));
  }

  const pattern = new RegExp(allKeywords.map(escapeRegex).join('|'), 'i');

  return Promise.all(
    files.map(async (file) => {
      const { hit_count, snippets } = await analyzeFile(
        toAbsolutePath(file),
        pattern,
      );
      return { file, snippets, hit_count };
    }),
  );
}

export type DocsSearcher = {
  findRelatedDocs: (entry: ChangelogEntry) => Promise<RelatedDoc[]>;
};

export const docsSearcher: DocsSearcher = {
  findRelatedDocs: async (entry) => {
    const keywordSet = extractKeywords(entry);
    const keywords = {
      original: [...keywordSet.original],
      normalized: [...keywordSet.normalized],
    };
    const searchResult = await searchDocs(keywords);
    const snippetResults = await extractSnippets(searchResult.files, keywords);

    return snippetResults.slice(0, 3).map(({ file, snippets, hit_count }) => ({
      file,
      snippets: snippets
        .map(normalizeMarkdownForAi)
        .filter((snippet) => snippet.length > 0),
      hitCount: hit_count,
    }));
  },
};
