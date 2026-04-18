import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// スーパータイプ: 全チャンネル共通情報
export const channels = sqliteTable(
  'channels',
  {
    id: text('id').primaryKey(),
    channelType: text('channel_type', { length: 3 })
      .notNull()
      .$type<'DSC' | 'SLK' | 'EML'>(),
    token: text('token').notNull().unique(),
    isActive: integer('is_active').notNull().default(1),
    failCount: integer('fail_count').notNull().default(0),
    createdAt: text('created_at').notNull().default(sql`(datetime('now'))`),
    updatedAt: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index('idx_channels_is_active').on(table.isActive)],
);

// サブタイプ: Discord 固有情報
export const discordChannels = sqliteTable('discord_channels', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  webhookUrl: text('webhook_url').notNull().unique(),
});

// サブタイプ: Slack 固有情報（将来用）
export const slackChannels = sqliteTable('slack_channels', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  webhookUrl: text('webhook_url').notNull().unique(),
});

// サブタイプ: メール固有情報（将来用）
export const emailChannels = sqliteTable('email_channels', {
  channelId: text('channel_id')
    .primaryKey()
    .references(() => channels.id),
  emailAddress: text('email_address').notNull().unique(),
});

// 通知設定（行持ちテーブル）
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
