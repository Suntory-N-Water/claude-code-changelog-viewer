import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Keywords } from '../types';

// プロジェクトルート
const PROJECT_ROOT = path.join(process.cwd(), '..', '..');

// ドキュメントディレクトリ（絶対パス）
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');
const EXCLUDED_FILE = 'changelog.md';

/**
 * ドキュメントコーパス: 相対パス → ファイル内容
 */
export type DocCorpus = Map<string, string>;

/**
 * 配列の合計を計算
 */
function sum(arr: number[]): number {
  return arr.reduce((acc, val) => acc + val, 0);
}

/**
 * ベクトルのL2ノルムを計算
 */
function norm(vector: number[]): number {
  return Math.sqrt(sum(vector.map((v) => v * v)));
}

/**
 * 2つのベクトルの内積を計算
 */
function innerProduct(va: number[], vb: number[]): number {
  return sum(va.map((_, idx) => va[idx] * vb[idx]));
}

/**
 * Cosine Similarityを計算
 */
function cosineSimilarity(va: number[], vb: number[]): number {
  const normA = norm(va);
  const normB = norm(vb);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return innerProduct(va, vb) / (normA * normB);
}

/**
 * ベクトルをL2正規化
 */
function normalizeL2(vector: number[]): number[] {
  const vectorNorm = norm(vector);
  if (vectorNorm === 0) {
    return vector;
  }
  return vector.map((v) => v / vectorNorm);
}

/**
 * 正規表現メタ文字をエスケープ
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * ドキュメント内のキーワード出現回数をカウント（大文字小文字無視）
 */
function countKeyword(content: string, keyword: string): number {
  const escaped = escapeRegex(keyword);
  const regex = new RegExp(escaped, 'gi');
  const matches = content.match(regex);
  return matches ? matches.length : 0;
}

/**
 * ドキュメントがキーワードを含むかチェック（大文字小文字無視）
 */
function containsKeyword(content: string, keyword: string): boolean {
  return content.toLowerCase().includes(keyword.toLowerCase());
}

/**
 * ドキュメントコーパスを読み込み
 *
 * docs-tracker/docs/en/ 配下の全 .md ファイルをメモリに読み込む。
 * キーは PROJECT_ROOT からの相対パス（grep-executor の出力と一致）。
 */
export function loadDocCorpus(): DocCorpus {
  const corpus: DocCorpus = new Map();
  const files = fs.readdirSync(DOCS_DIR);

  for (const file of files) {
    if (!file.endsWith('.md') || file === EXCLUDED_FILE) {
      continue;
    }
    const absolutePath = path.join(DOCS_DIR, file);
    const relativePath = path.relative(PROJECT_ROOT, absolutePath);
    const content = fs.readFileSync(absolutePath, 'utf-8');
    corpus.set(relativePath, content);
  }

  return corpus;
}

/**
 * キーワードのIDFテーブルを構築
 *
 * IDF = log((N + 1) / (df + 1)) + 1
 * - N: コーパス内の総ドキュメント数
 * - df: そのキーワードを含むドキュメント数
 * - 珍しいキーワードほど IDF が高くなる
 */
export function buildIdfTable(
  keywords: Keywords,
  corpus: DocCorpus,
): Map<string, number> {
  const vocab = [...new Set([...keywords.original, ...keywords.normalized])];
  const N = corpus.size;
  const idfTable = new Map<string, number>();

  for (const keyword of vocab) {
    let df = 0;
    for (const content of corpus.values()) {
      if (containsKeyword(content, keyword)) {
        df++;
      }
    }
    idfTable.set(keyword, Math.log((N + 1) / (df + 1)) + 1);
  }

  return idfTable;
}

/**
 * TF-IDF Cosine Similarity でドキュメントの関連度を計算
 *
 * クエリ（CHANGELOG項目）とドキュメント間の類似度を返す（0〜1）。
 * - クエリベクトル: 各キーワードの TF=1, IDF 加重
 * - ドキュメントベクトル: 各キーワードの TF=出現回数, IDF 加重
 * - 両ベクトルを L2 正規化し Cosine Similarity を計算
 */
export function calculateTfidfSimilarity(
  docFile: string,
  corpus: DocCorpus,
  idfTable: Map<string, number>,
): number {
  const docContent = corpus.get(docFile);
  if (!docContent) {
    return 0;
  }

  const vocab = [...idfTable.keys()];
  if (vocab.length === 0) {
    return 0;
  }

  // クエリベクトル: 各キーワードの TF=1 × IDF
  const queryVector = vocab.map((kw) => idfTable.get(kw) ?? 0);

  // ドキュメントベクトル: 各キーワードの TF=出現回数 × IDF
  const docVector = vocab.map((kw) => {
    const tf = countKeyword(docContent, kw);
    return tf * (idfTable.get(kw) ?? 0);
  });

  return cosineSimilarity(normalizeL2(queryVector), normalizeL2(docVector));
}
