import { workerLogger } from '../../logger';
import { toError } from '@claude-code-changelog-viewer/common';
import { NonRetryableError } from 'cloudflare:workflows';
import { z } from 'zod';
import type { D1ExportPort } from '../../usecases/d1-backup-workflow';

// API リファレンスは status を complete / error のみと書いているが、
// 実際は進行中を表す値 (active 等) も返る。wrangler 自身も complete / error 以外を
// 進行中として扱っているため、ここでも列挙せず開いた文字列で受ける。
const ExportResponseSchema = z.object({
  result: z.object({
    at_bookmark: z.string().optional(),
    error: z.string().optional(),
    status: z.string().optional(),
    result: z
      .object({ filename: z.string(), signed_url: z.string() })
      .optional(),
  }),
});

const logger = workerLogger('infrastructure.d1.export-client');

export type D1ExportClientConfig = {
  accountId: string;
  databaseId: string;
  apiToken: string;
};

/** D1 の export は Workers binding に無く、REST API のポーリングでしか取得できない。 */
export function createD1ExportClient({
  accountId,
  databaseId,
  apiToken,
}: D1ExportClientConfig): D1ExportPort {
  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/export`;

  async function requestExport(currentBookmark?: string) {
    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          output_format: 'polling',
          ...(currentBookmark === undefined
            ? {}
            : { current_bookmark: currentBookmark }),
        }),
      });
    } catch (error) {
      logger.error('D1 export API の呼び出しに失敗しました', {
        error: toError(error),
      });
      throw error;
    }
    if (!response.ok) {
      logger.error('D1 export API の呼び出しに失敗しました', {
        'http.response.status_code': response.status,
      });
      throw new Error(
        `D1 export API の呼び出しに失敗しました: ${response.status} ${response.statusText}`,
      );
    }

    const parsed = ExportResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error(
        `D1 export API の応答形式が不正です: ${z.prettifyError(parsed.error)}`,
      );
    }

    const { result } = parsed.data;
    // 未完了は再試行で解消するが、status: 'error' は再試行しても変わらないため即座に失敗させる。
    if (result.status === 'error') {
      logger.error('D1 export に失敗しました', {
        'd1.export.status': result.status,
      });
      throw new NonRetryableError(
        `D1 export に失敗しました: ${result.error ?? '(エラーメッセージなし)'}`,
      );
    }

    logger.info('D1 export API の応答を受信しました', {
      'http.response.status_code': response.status,
      'd1.export.status': result.status ?? 'in_progress',
      'd1.export.completed': result.result !== undefined,
    });

    return result;
  }

  return {
    async start(): Promise<string> {
      const result = await requestExport();
      if (result.at_bookmark === undefined) {
        throw new Error('D1 export の開始要求が bookmark を返しませんでした');
      }
      return result.at_bookmark;
    },

    async fetchDump(bookmark) {
      const result = await requestExport(bookmark);
      if (result.result === undefined) {
        // 進行中。ポーリングを止めると export 自体がキャンセルされるため、step のリトライで再度問い合わせる。
        throw new Error('D1 export がまだ完了していません');
      }

      let dump: Response;
      try {
        dump = await fetch(result.result.signed_url);
      } catch (error) {
        logger.error('D1 export のダウンロードに失敗しました', {
          error: toError(error),
        });
        throw error;
      }
      if (!dump.ok) {
        logger.error('D1 export のダウンロードに失敗しました', {
          'http.response.status_code': dump.status,
        });
        throw new Error(
          `D1 export のダウンロードに失敗しました: ${dump.status} ${dump.statusText}`,
        );
      }
      if (dump.body === null) {
        throw new Error('D1 export のダウンロード応答に本文がありませんでした');
      }

      logger.info('D1 export をダウンロードしました', {
        'http.response.status_code': dump.status,
        'resource.name': result.result.filename,
      });

      return { filename: result.result.filename, body: dump.body };
    },
  };
}
