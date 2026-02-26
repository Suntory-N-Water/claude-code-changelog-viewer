import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { createChangelogMessage, sendToDiscord } from '../lib/discord';
import type { NotificationMessage, WebhookRow } from '../types';

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Suntory-N-Water/claude-code-changelog-viewer/main/apps/changelog-fetcher/inferred';

// 失敗でactive=0にする閾値
const MAX_FAIL_COUNT = 3;

// 送信失敗時にactive=0にするHTTPステータス
const PERMANENT_FAILURE_STATUSES = [401, 403, 404];

export const queueConsumer: ExportedHandler<CloudflareBindings>['queue'] =
  async (batch, env) => {
    for (const message of batch.messages) {
      const { version } = message.body as NotificationMessage;

      // GitHub Raw URLからinferred JSONを取得
      const inferredUrl = `${GITHUB_RAW_BASE}/inferred_${version}.json`;
      const response = await fetch(inferredUrl);
      if (!response.ok) {
        console.error(
          `inferred JSONの取得に失敗: ${inferredUrl} (${response.status})`,
        );
        message.retry();
        continue;
      }

      const rawData = await response.json();
      const parseResult = AnalysisSchema.safeParse(rawData);
      if (!parseResult.success) {
        console.error(
          `inferred JSONのパースに失敗: ${parseResult.error.message}`,
        );
        message.retry();
        continue;
      }
      const data = parseResult.data;

      // アクティブなWebhook一覧を取得
      const { results } = await env.DB.prepare(
        'SELECT id, webhook_url, token FROM webhooks WHERE active = 1',
      ).all<Pick<WebhookRow, 'id' | 'webhook_url' | 'token'>>();

      if (!results || results.length === 0) {
        console.log('アクティブなWebhookが存在しません');
        message.ack();
        continue;
      }

      // 各登録者に送信
      for (const webhook of results) {
        const unsubscribeUrl = `${env.WORKER_URL}/api/unsubscribe?token=${webhook.token}`;
        const payload = createChangelogMessage(data, version, unsubscribeUrl);
        const result = await sendToDiscord(webhook.webhook_url, payload);

        if (result.ok) {
          // 成功: fail_countをリセット
          await env.DB.prepare(
            "UPDATE webhooks SET fail_count = 0, updated_at = datetime('now') WHERE id = ?",
          )
            .bind(webhook.id)
            .run();
        } else if (result.status === 429) {
          // レート制限: retry_after 待機してリトライ
          // NOTE: Queue consumerではメッセージ単位のリトライで対応
          console.warn(`レート制限を受信 (webhook: ${webhook.id})`);
        } else if (PERMANENT_FAILURE_STATUSES.includes(result.status)) {
          // 永続的な失敗: fail_countを加算
          const updateResult = await env.DB.prepare(
            "UPDATE webhooks SET fail_count = fail_count + 1, updated_at = datetime('now') WHERE id = ? RETURNING fail_count",
          )
            .bind(webhook.id)
            .first<{ fail_count: number }>();

          if (updateResult && updateResult.fail_count >= MAX_FAIL_COUNT) {
            await env.DB.prepare(
              "UPDATE webhooks SET active = 0, updated_at = datetime('now') WHERE id = ?",
            )
              .bind(webhook.id)
              .run();
            console.warn(
              `Webhookを無効化 (id: ${webhook.id}, fail_count: ${updateResult.fail_count})`,
            );
          }
        } else {
          console.error(
            `送信失敗 (webhook: ${webhook.id}, status: ${result.status})`,
          );
        }

        // Discord API rate limit を避けるため、各送信間に1秒間隔
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      message.ack();
    }
  };
