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
