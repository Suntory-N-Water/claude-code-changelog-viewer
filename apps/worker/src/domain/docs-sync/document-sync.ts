/** 取得一覧の急減による誤削除を防ぐため、古いドキュメントを削除できるか判定する。 */
export function isSafeToDeleteStaleDocuments(
  existingCount: number,
  expectedCount: number,
): boolean {
  return expectedCount >= existingCount / 2;
}
