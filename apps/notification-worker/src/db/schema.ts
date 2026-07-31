import { sql } from 'drizzle-orm';
import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core';
import { CHANNEL_ACTIVE_SENTINEL } from './constants';

// スーパータイプ: 全チャンネル共通情報
export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    channelType: text('channel_type', { length: 3 })
      .notNull()
      .$type<'DSC' | 'SLK' | 'EML'>(),
    token: text('token').notNull().unique(),
    // CHANNEL_ACTIVE_SENTINEL = 有効中、それ以外 = 無効化日時
    deactivatedAt: text('deactivated_at')
      .notNull()
      .default(CHANNEL_ACTIVE_SENTINEL),
    // 'none' = 有効中、'user' = ユーザー停止、'system' = 失敗閾値超過
    deactivatedReason: text('deactivated_reason')
      .notNull()
      .default('none')
      .$type<'none' | 'user' | 'system'>(),
    failCount: integer('fail_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_channels_deactivated_at').on(table.deactivatedAt)],
);

// サブタイプ: Discord 固有情報
export const discordChannels = sqliteTable('discord_channels', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  webhookUrl: text('webhook_url').notNull().unique(),
});

// サブタイプ: Slack 固有情報
export const slackChannels = sqliteTable('slack_channels', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  webhookUrl: text('webhook_url').notNull().unique(),
});

// サブタイプ: メール固有情報
export const emailChannels = sqliteTable('email_channels', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  emailHash: text('email_hash').notNull().unique(),
  emailEncrypted: text('email_encrypted').notNull(),
});

// 通知設定(行持ちテーブル)
// frequency: IMM=即時, WEK=週次
export const notificationSettings = sqliteTable(
  'notification_settings',
  {
    id: text('id').primaryKey(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id),
    frequency: text('frequency', { length: 3 })
      .notNull()
      .$type<'IMM' | 'WEK'>(),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [
    index('idx_notification_settings_channel_id').on(table.channelId),
  ],
);

// version・チャンネル単位の配信完了記録。Queue 再試行時の重複送信を防ぐ。
export const notificationDeliveries = sqliteTable(
  'notification_deliveries',
  {
    version: text('version').notNull(),
    channelId: text('channel_id')
      .notNull()
      .references(() => channels.id),
    deliveredAt: text('delivered_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [primaryKey({ columns: [table.version, table.channelId] })],
);
