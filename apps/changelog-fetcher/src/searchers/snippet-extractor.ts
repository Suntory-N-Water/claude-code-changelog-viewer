import type { Keywords, SnippetResult } from '../types';
import { toAbsolutePath } from './paths';

const MAX_SNIPPETS_PER_FILE = 5;

/**
 * 正規表現メタ文字をエスケープ
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ファイルを解析してマッチ行数とスニペットを返す
 */
async function analyzeFile(
  absolutePath: string,
  pattern: RegExp,
): Promise<{ hit_count: number; snippets: string[] }> {
  const content = await Bun.file(absolutePath).text();
  const lines = content.split('\n');

  // マッチ行のインデックスを収集
  const matchIndices: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
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

    if (blocks.length > 0 && start <= blocks[blocks.length - 1].end + 1) {
      blocks[blocks.length - 1].end = end;
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
  keywords: Keywords,
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
