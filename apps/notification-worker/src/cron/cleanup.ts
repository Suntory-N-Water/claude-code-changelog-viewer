import { and, eq, inArray, lt, sql } from 'drizzle-orm';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import {
  channels,
  discordChannels,
  emailChannels,
  notificationSettings,
  slackChannels,
} from '../db/schema';

export async function cleanupInactiveChannels(
  db: DrizzleD1Database<Record<string, never>>,
) {
  // 30日以上非アクティブなチャンネルのIDを取得
  const inactiveChannels = await db
    .select({ id: channels.id })
    .from(channels)
    .where(
      and(
        eq(channels.isActive, 0),
        lt(channels.updatedAt, sql`(datetime('now', '-30 days'))`),
      ),
    );

  if (inactiveChannels.length === 0) {
    return;
  }
  const channelIds = inactiveChannels.map((c) => c.id);

  // D1の batch を用いて同一トランザクションとして一括削除
  await db.batch([
    db
      .delete(discordChannels)
      .where(inArray(discordChannels.channelId, channelIds)),
    db
      .delete(slackChannels)
      .where(inArray(slackChannels.channelId, channelIds)),
    db
      .delete(emailChannels)
      .where(inArray(emailChannels.channelId, channelIds)),
    db
      .delete(notificationSettings)
      .where(inArray(notificationSettings.channelId, channelIds)),
    db.delete(channels).where(inArray(channels.id, channelIds)),
  ]);
}
