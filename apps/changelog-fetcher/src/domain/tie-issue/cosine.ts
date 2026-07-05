// CHANGELOG 項目 embedding 1本と issue embedding 群の cosine 類似度を計算する。
// - embedding は Gemini の返す `number[]` をそのまま使う
// - 事前正規化しない（正規化してもしなくても cosine の順序は変わらない）

export type IssueEmbedding = {
  number: number;
  embedding: number[];
};

export type CosineHit = {
  number: number;
  score: number;
};

export function topKCosine(
  queryEmbedding: number[],
  issueEmbeddings: IssueEmbedding[],
  k: number,
): CosineHit[] {
  if (queryEmbedding.length === 0 || issueEmbeddings.length === 0 || k <= 0) {
    return [];
  }
  const queryNorm = norm(queryEmbedding);
  if (queryNorm === 0) {
    return [];
  }

  const hits: CosineHit[] = [];
  for (const item of issueEmbeddings) {
    if (item.embedding.length !== queryEmbedding.length) {
      continue;
    }
    const dot = innerProduct(queryEmbedding, item.embedding);
    const issueNorm = norm(item.embedding);
    if (issueNorm === 0) {
      continue;
    }
    hits.push({ number: item.number, score: dot / (queryNorm * issueNorm) });
  }

  hits.sort((a, b) => b.score - a.score);
  return hits.slice(0, k);
}

function innerProduct(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i += 1) {
    sum += (a[i] ?? 0) * (b[i] ?? 0);
  }
  return sum;
}

function norm(v: number[]): number {
  let sum = 0;
  for (const x of v) {
    sum += x * x;
  }
  return Math.sqrt(sum);
}
