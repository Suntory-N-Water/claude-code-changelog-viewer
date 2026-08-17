import { NonRetryableError } from 'cloudflare:workflows';
import { z } from 'zod';
import type { D1ExportPort } from '../../usecases/d1-backup-workflow';

const ExportResponseSchema = z.object({
  result: z.object({
    at_bookmark: z.string().optional(),
    error: z.string().optional(),
    status: z.enum(['complete', 'error']).optional(),
    result: z
      .object({ filename: z.string(), signed_url: z.string() })
      .optional(),
  }),
});

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
    const response = await fetch(endpoint, {
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
    if (!response.ok) {
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
      throw new NonRetryableError(
        `D1 export に失敗しました: ${result.error ?? '(エラーメッセージなし)'}`,
      );
    }

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

      const dump = await fetch(result.result.signed_url);
      if (!dump.ok) {
        throw new Error(
          `D1 export のダウンロードに失敗しました: ${dump.status} ${dump.statusText}`,
        );
      }
      if (dump.body === null) {
        throw new Error('D1 export のダウンロード応答に本文がありませんでした');
      }

      return { filename: result.result.filename, body: dump.body };
    },
  };
}
