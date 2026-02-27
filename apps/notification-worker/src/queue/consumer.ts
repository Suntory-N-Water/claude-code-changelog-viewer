import { getLogger } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { z } from 'zod';
import { createChangelogMessage, sendToDiscord } from '../lib/discord';
import type { WebhookRow } from '../types';

const logger = getLogger({
  name: 'notification-worker',
  level: 'INFO',
  format: 'json',
});

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Suntory-N-Water/claude-code-changelog-viewer/main/apps/changelog-fetcher/inferred';

// 失敗でactive=0にする閾値
const MAX_FAIL_COUNT = 3;

// 送信失敗時にactive=0にするHTTPステータス
const PERMANENT_FAILURE_STATUSES = [401, 403, 404];

const NotificationMessageSchema = z.object({
  version: z.string().startsWith('v'),
});

export const queueConsumer: ExportedHandler<CloudflareBindings>['queue'] =
  async (batch, env) => {
    for (const message of batch.messages) {
      // メッセージボディのバリデーション
      const bodyResult = NotificationMessageSchema.safeParse(message.body);
      if (!bodyResult.success) {
        logger.error('不正なキューメッセージ', {
          error: bodyResult.error.message,
        });
        message.ack();
        continue;
      }
      const { version } = bodyResult.data;

      // GitHub Raw URLからinferred JSONを取得
      const inferredUrl = `${GITHUB_RAW_BASE}/inferred_${version}.json`;
      const response = await fetch(inferredUrl);
      if (!response.ok) {
        logger.error('inferred JSONの取得に失敗', {
          url: inferredUrl,
          status: response.status,
        });
        message.retry();
        continue;
      }

      const rawData = await response.json();
      const parseResult = AnalysisSchema.safeParse(rawData);
      if (!parseResult.success) {
        logger.error('inferred JSONのパースに失敗', {
          error: parseResult.error.message,
        });
        message.retry();
        continue;
      }
      const data = parseResult.data;

      // アクティブなWebhook一覧を取得
      const { results } = await env.DB.prepare(
        'SELECT id, webhook_url, token FROM webhooks WHERE active = 1',
      ).all<Pick<WebhookRow, 'id' | 'webhook_url' | 'token'>>();

      if (!results || results.length === 0) {
        logger.info('アクティブなWebhookが存在しません');
        message.ack();
        continue;
      }

      // 各登録者に送信
      let hasRateLimitFailure = false;

      for (const webhook of results) {
        try {
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
            // レート制限: メッセージをリトライして全 webhook を再処理する
            logger.warn('レート制限を受信', { webhookId: webhook.id });
            hasRateLimitFailure = true;
            break;
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
              logger.warn('Webhookを無効化', {
                webhookId: webhook.id,
                failCount: updateResult.fail_count,
              });
            }
          } else {
            logger.error('送信失敗', {
              webhookId: webhook.id,
              status: result.status,
            });
          }
        } catch (error) {
          // ネットワーク障害などの予期しないエラー: ログに記録して次の webhook に続行
          if (error instanceof Error) {
            logger.error('webhook送信中に例外が発生', error);
          } else {
            logger.error('webhook送信中に例外が発生', {
              webhookId: webhook.id,
              error: String(error),
            });
          }
        }

        // Discord API rate limit を避けるため、各送信間に1秒間隔
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      if (hasRateLimitFailure) {
        // レート制限を受けた場合はメッセージをリトライ(既に成功した webhook は fail_count=0 のため影響なし)
        message.retry();
      } else {
        message.ack();
      }
    }
  };
