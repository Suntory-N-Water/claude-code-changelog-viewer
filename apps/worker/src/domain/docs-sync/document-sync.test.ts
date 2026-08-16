import { describe, expect, it } from 'vitest';
import { isSafeToDeleteStaleDocuments } from './document-sync';

describe('ドキュメント同期の削除安全ポリシー', () => {
  it('取得できた一覧が既存件数の半分未満なら削除を許可しない', () => {
    expect(isSafeToDeleteStaleDocuments(3, 1)).toBe(false);
  });

  it('取得できた一覧が既存件数の半分以上なら削除を許可する', () => {
    expect(isSafeToDeleteStaleDocuments(3, 2)).toBe(true);
  });
});
