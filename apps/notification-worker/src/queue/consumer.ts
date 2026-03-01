import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { z } from 'zod';
import {
  buildUnsubscribeUrl,
  createChangelogMessage,
  sendToDiscord,
} from '../lib/discord';
import type { WebhookRow } from '../types';

const logger = getLogger({
  name: 'notification-worker',
  level: 'INFO',
  format: 'json',
});

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Suntory-N-Water/claude-code-changelog-viewer/main/apps/changelog-fetcher/inferred';

// 失敗で active=0 にする閾値
const MAX_FAIL_COUNT = 3;

// 送信失敗時に active=0 にする HTTP ステータス
const PERMANENT_FAILURE_STATUSES = [401, 403, 404];

const NotificationMessageSchema = z.object({
  version: z.string().startsWith('v'),
});

export const queueConsumer: ExportedHandler<CloudflareBindings>['queue'] =
  async (batch, env) => {
    for (const message of batch.messages) {
      const bodyResult = NotificationMessageSchema.safeParse(message.body);
      if (!bodyResult.success) {
        logger.error('不正なキューメッセージ', {
          error: bodyResult.error.message,
        });
        message.ack();
        continue;
      }
      const { version } = bodyResult.data;

      // GitHub Raw URL から inferred JSON を取得
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

      // アクティブな Webhook 一覧を取得(fail_count も含めて条件付き UPDATE に利用)
      const { results } = await env.DB.prepare(
        'SELECT id, webhook_url, token, fail_count FROM webhooks WHERE active = 1',
      ).all<Pick<WebhookRow, 'id' | 'webhook_url' | 'token' | 'fail_count'>>();

      if (!results || results.length === 0) {
        logger.info('アクティブなWebhookが存在しません');
        message.ack();
        continue;
      }

      let hasRateLimitFailure = false;
      const lastIndex = results.length - 1;

      for (const [i, webhook] of results.entries()) {
        try {
          const unsubscribeUrl = buildUnsubscribeUrl(
            env.WORKER_URL,
            webhook.token,
          );
          const payload = createChangelogMessage(
            data,
            version,
            unsubscribeUrl,
            env.SITE_URL,
          );
          const result = await sendToDiscord(webhook.webhook_url, payload);

          if (result.ok) {
            // fail_count が 0 でない場合のみリセット
            if (webhook.fail_count > 0) {
              await env.DB.prepare(
                "UPDATE webhooks SET fail_count = 0, updated_at = datetime('now') WHERE id = ?",
              )
                .bind(webhook.id)
                .run();
            }
          } else if (result.status === 429) {
            // レート制限: メッセージをリトライして全 webhook を再処理する
            logger.warn('レート制限を受信', { webhookId: webhook.id });
            hasRateLimitFailure = true;
            break;
          } else if (PERMANENT_FAILURE_STATUSES.includes(result.status)) {
            // fail_count 加算 + 閾値超過時は active=0 を 1 クエリで実行
            const updateResult = await env.DB.prepare(
              `UPDATE webhooks
               SET fail_count = fail_count + 1,
                   active = CASE WHEN fail_count + 1 >= ${MAX_FAIL_COUNT} THEN 0 ELSE active END,
                   updated_at = datetime('now')
               WHERE id = ?
               RETURNING fail_count, active`,
            )
              .bind(webhook.id)
              .first<{ fail_count: number; active: number }>();

            if (updateResult && updateResult.active === 0) {
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
          logger.error('webhook送信中に例外が発生', toError(error));
        }

        // Discord API rate limit を避けるため、各送信間に 1 秒間隔(最後は待たない)
        if (i < lastIndex) {
          await new Promise((resolve) => setTimeout(resolve, 1 * 1000));
        }
      }

      if (hasRateLimitFailure) {
        message.retry();
      } else {
        message.ack();
      }
    }
  };
