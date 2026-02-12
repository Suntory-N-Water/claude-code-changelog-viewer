type CatalogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

type CatalogEntry = {
  level: CatalogLevel;
  template: string;
};

/**
 * Centralized log message catalog.
 * Templates use $0, $1, ... as positional placeholders.
 */
const LOG_CATALOG = {
  // --- INFO ---
  /** $0 を開始します */
  APLG0001: { level: 'INFO', template: '$0 を開始します' },
  /** $0 が完了しました */
  APLG0002: { level: 'INFO', template: '$0 が完了しました' },
  /** $0 を取得しています */
  APLG0003: { level: 'INFO', template: '$0 を取得しています' },
  /** $0 を初期化しました */
  APLG0004: { level: 'INFO', template: '$0 を初期化しました' },
  /** $0 を削除しました */
  APLG0005: { level: 'INFO', template: '$0 を削除しました' },
  /** $0 をクリーンアップしました */
  APLG0006: { level: 'INFO', template: '$0 をクリーンアップしました' },
  /** $0 の変更を検知しました */
  APLG0007: { level: 'INFO', template: '$0 の変更を検知しました' },
  /** $0 に変更はありませんでした */
  APLG0008: { level: 'INFO', template: '$0 に変更はありませんでした' },
  /** 取得結果サマリー */
  APLG0009: { level: 'INFO', template: '取得結果サマリー' },
  /** $0 を検出しました */
  APLG0010: { level: 'INFO', template: '$0 を検出しました' },
  /** $0 を処理しています */
  APLG0020: { level: 'INFO', template: '$0 を処理しています' },
  /** $0 を保存しました */
  APLG0021: { level: 'INFO', template: '$0 を保存しました' },
  /** $0 を送信しました */
  APLG0023: { level: 'INFO', template: '$0 を送信しました' },

  // --- WARN ---
  /** $0 の取得に失敗しました */
  APLG0011: { level: 'WARN', template: '$0 の取得に失敗しました' },
  /** $0 が見つかりませんでした */
  APLG0012: { level: 'WARN', template: '$0 が見つかりませんでした' },
  /** $0 の確認に失敗しました */
  APLG0013: { level: 'WARN', template: '$0 の確認に失敗しました' },
  /** リトライを実行します */
  APLG0014: { level: 'WARN', template: 'リトライを実行します' },
  /** $0 にフォールバックします */
  APLG0024: { level: 'WARN', template: '$0 にフォールバックします' },

  // --- ERROR ---
  /** $0 の取得に失敗しました */
  APLG0015: { level: 'ERROR', template: '$0 の取得に失敗しました' },
  /** $0 の削除に失敗しました */
  APLG0016: { level: 'ERROR', template: '$0 の削除に失敗しました' },
  /** $0 の保存に失敗しました */
  APLG0017: { level: 'ERROR', template: '$0 の保存に失敗しました' },
  /** $0 の検証に失敗しました */
  APLG0022: { level: 'ERROR', template: '$0 の検証に失敗しました' },

  // --- FATAL ---
  /** 致命的なエラーが発生しました */
  APLG0018: { level: 'FATAL', template: '致命的なエラーが発生しました' },
  /** 未処理のエラーが発生しました */
  APLG0019: { level: 'FATAL', template: '未処理のエラーが発生しました' },
} as const satisfies Record<string, CatalogEntry>;

/**
 * TODO: keyof typeof で定義するとIDに対してログIDが何を出力するのか分からない
 */
type LogId = keyof typeof LOG_CATALOG;

export { LOG_CATALOG };
export type { LogId };
