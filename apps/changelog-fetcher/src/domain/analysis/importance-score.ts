declare const importanceScoreBrand: unique symbol;

export type ImportanceScore = number & {
  readonly [importanceScoreBrand]: unknown;
};

const IMPORTANCE_SCORES: Record<string, number> = {
  Added: 8,
  Fixed: 4,
  Changed: 6,
  Improved: 6,
  Updated: 6,
  Removed: 5,
  Enabled: 6,
  Deprecated: 7,
  Breaking: 9,
};

/**
 * 負数や非数値を拒否して重要度スコアを生成する。
 */
export function createImportanceScore(value: number): ImportanceScore {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`重要度スコアの形式が不正です: ${value}`);
  }

  return value as ImportanceScore;
}

/**
 * CHANGELOG の prefix と tag から重要度を算出する。
 */
export function calculateImportanceScore(
  prefix: string,
  tags: readonly string[],
): ImportanceScore {
  const baseScore = IMPORTANCE_SCORES[prefix] ?? 5;
  const breakingBonus = tags.includes('Breaking') ? 3 : 0;
  return createImportanceScore(baseScore + breakingBonus);
}
