/**
 * セマンティックバージョンを降順比較する
 * sort() のコンパレータとして使用: 新しいバージョンが先頭に来る
 */
export function semverCompareDesc(a: string, b: string): number {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const diff = (pb.at(i) ?? 0) - (pa.at(i) ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

/**
 * v2.1.0 より古いバージョンかどうかを判定する
 * v0.x.x / v1.x.x / v2.0.x は AI 要約未対応のレガシーバージョン
 */
export function isLegacyVersion(version: string): boolean {
  return semverCompareDesc(version, '2.1.0') > 0;
}
