type CatalogLevel = 'INFO' | 'WARN' | 'ERROR' | 'FATAL';

type CatalogEntry = {
  level: CatalogLevel;
  template: string;
};

/**
 * Centralized log message catalog.
 * Log messages are fixed. Variable values belong in attrs.
 */
const LOG_CATALOG = {
  /** ジョブを開始します */
  APLG0001: { level: 'INFO', template: 'ジョブを開始します' },
  /** ジョブが完了しました */
  APLG0002: { level: 'INFO', template: 'ジョブが完了しました' },
  /** 取得しています */
  APLG0003: { level: 'INFO', template: '取得しています' },
  /** 初期化しました */
  APLG0004: { level: 'INFO', template: '初期化しました' },
  /** 削除しました */
  APLG0005: { level: 'INFO', template: '削除しました' },
  /** クリーンアップしました */
  APLG0006: { level: 'INFO', template: 'クリーンアップしました' },
  /** 変更を検知しました */
  APLG0007: { level: 'INFO', template: '変更を検知しました' },
  /** 変更はありませんでした */
  APLG0008: { level: 'INFO', template: '変更はありませんでした' },
  /** 取得結果サマリー */
  APLG0009: { level: 'INFO', template: '取得結果サマリー' },
  /** 検出しました */
  APLG0010: { level: 'INFO', template: '検出しました' },
  /** 処理しています */
  APLG0020: { level: 'INFO', template: '処理しています' },
  /** 保存しました */
  APLG0021: { level: 'INFO', template: '保存しました' },
  /** 送信しました */
  APLG0023: { level: 'INFO', template: '送信しました' },
  /** HTTPリクエストを受信しました */
  APLG0030: { level: 'INFO', template: 'HTTPリクエストを受信しました' },
  /** HTTPリクエストが完了しました */
  APLG0031: { level: 'INFO', template: 'HTTPリクエストが完了しました' },

  /** 取得に失敗しました */
  APLG0011: { level: 'WARN', template: '取得に失敗しました' },
  /** 見つかりませんでした */
  APLG0012: { level: 'WARN', template: '見つかりませんでした' },
  /** 確認に失敗しました */
  APLG0013: { level: 'WARN', template: '確認に失敗しました' },
  /** リトライを実行します */
  APLG0014: { level: 'WARN', template: 'リトライを実行します' },
  /** フォールバックします */
  APLG0024: { level: 'WARN', template: 'フォールバックします' },
  /** CHANGELOG ハッシュ不一致 */
  APLG0025: { level: 'WARN', template: 'CHANGELOG ハッシュ不一致' },

  /** 取得に失敗しました */
  APLG0015: { level: 'ERROR', template: '取得に失敗しました' },
  /** 削除に失敗しました */
  APLG0016: { level: 'ERROR', template: '削除に失敗しました' },
  /** 保存に失敗しました */
  APLG0017: { level: 'ERROR', template: '保存に失敗しました' },
  /** 検証に失敗しました */
  APLG0022: { level: 'ERROR', template: '検証に失敗しました' },

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
