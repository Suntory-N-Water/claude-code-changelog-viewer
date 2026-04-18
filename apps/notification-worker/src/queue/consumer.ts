import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildUnsubscribeUrl,
  createChangelogMessage,
  sendToDiscord,
} from '../lib/discord';
import { channels, discordChannels, notificationSettings } from '../db/schema';

const logger = getLogger({
  name: 'notification-worker',
  level: 'INFO',
  format: 'json',
});

const GITHUB_RAW_BASE =
  'https://raw.githubusercontent.com/Suntory-N-Water/claude-code-changelog-viewer/main/apps/changelog-fetcher/inferred';

// 失敗で is_active=0 にする閾値
const MAX_FAIL_COUNT = 3;

// 送信失敗時に is_active=0 にする HTTP ステータス
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

      // アクティブかつ IMM 設定のチャンネル一覧を取得
      const db = drizzle(env.DB);
      const rows = await db
        .select({
          id: channels.id,
          webhookUrl: discordChannels.webhookUrl,
          token: channels.token,
          failCount: channels.failCount,
        })
        .from(channels)
        .innerJoin(discordChannels, eq(discordChannels.channelId, channels.id))
        .innerJoin(
          notificationSettings,
          eq(notificationSettings.channelId, channels.id),
        )
        .where(
          and(
            eq(channels.isActive, 1),
            eq(notificationSettings.frequency, 'IMM'),
          ),
        );

      if (rows.length === 0) {
        logger.info('アクティブなチャンネルが存在しません');
        message.ack();
        continue;
      }

      let hasRateLimitFailure = false;
      const lastIndex = rows.length - 1;

      for (const [i, webhook] of rows.entries()) {
        try {
          const unsubscribeUrl = buildUnsubscribeUrl(
            env.WORKER_URL,
            webhook.token,
          );
          const payload = createChangelogMessage(data, version, {
            unsubscribeUrl,
            siteUrl: env.SITE_URL,
          });
          const result = await sendToDiscord(webhook.webhookUrl, payload);

          if (result.ok) {
            // fail_count が 0 でない場合のみリセット
            if (webhook.failCount > 0) {
              await db
                .update(channels)
                .set({ failCount: 0, updatedAt: sql`datetime('now')` })
                .where(eq(channels.id, webhook.id));
            }
          } else if (result.status === 429) {
            // レート制限: メッセージをリトライして全チャンネルを再処理する
            logger.warn('レート制限を受信', { channelId: webhook.id });
            hasRateLimitFailure = true;
            break;
          } else if (PERMANENT_FAILURE_STATUSES.includes(result.status)) {
            // fail_count 加算 + 閾値超過時は is_active=0 を 1 クエリで実行
            const [updateResult] = await db
              .update(channels)
              .set({
                failCount: sql`${channels.failCount} + 1`,
                isActive: sql`CASE WHEN ${channels.failCount} + 1 >= ${MAX_FAIL_COUNT} THEN 0 ELSE ${channels.isActive} END`,
                updatedAt: sql`datetime('now')`,
              })
              .where(eq(channels.id, webhook.id))
              .returning({
                failCount: channels.failCount,
                isActive: channels.isActive,
              });

            if (updateResult && updateResult.isActive === 0) {
              logger.warn('チャンネルを無効化', {
                channelId: webhook.id,
                failCount: updateResult.failCount,
              });
            }
          } else {
            logger.error('送信失敗', {
              channelId: webhook.id,
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
