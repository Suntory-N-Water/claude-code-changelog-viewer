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

// changelog 系テーブル: MCP サーバーの読み取り用。通知系とは独立。
export const changelogVersions = sqliteTable('changelog_versions', {
  version: text('version').primaryKey(),
  // 旧バージョンの inferred ファイルには summary がない
  summary: text('summary'),
});

// item id は同一内容のエントリが複数バージョンに現れると重複するため、
// (version, item_id) の複合 PK にする
export const changelogItems = sqliteTable(
  'changelog_items',
  {
    version: text('version').notNull(),
    itemId: text('item_id').notNull(),
    content: text('content').notNull(),
    contentJa: text('content_ja'),
    prefix: text('prefix').notNull(),
    inferenceBefore: text('inference_before'),
    inferenceAfter: text('inference_after'),
    inferenceBenefit: text('inference_benefit'),
    // content + content_ja + version の summary を NFKC 正規化・小文字化して連結した検索用カラム。
    // D1 は LIKE パターン長が 50 バイトのため instr() で検索する
    searchText: text('search_text').notNull(),
  },
  (table) => [primaryKey({ columns: [table.version, table.itemId] })],
);

export const changelogItemFeatureAreas = sqliteTable(
  'changelog_item_feature_areas',
  {
    version: text('version').notNull(),
    itemId: text('item_id').notNull(),
    featureArea: text('feature_area').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.version, table.itemId, table.featureArea] }),
  ],
);

export const changelogItemRelatedDocs = sqliteTable(
  'changelog_item_related_docs',
  {
    version: text('version').notNull(),
    itemId: text('item_id').notNull(),
    docPath: text('doc_path').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.version, table.itemId, table.docPath] }),
  ],
);

export const changelogDiffEvents = sqliteTable(
  'changelog_diff_events',
  {
    version: text('version').notNull(),
    detectedAt: text('detected_at').notNull(),
    type: text('type').notNull().$type<'items_changed' | 'version_removed'>(),
  },
  (table) => [primaryKey({ columns: [table.version, table.detectedAt] })],
);

export const changelogDiffEventItems = sqliteTable(
  'changelog_diff_event_items',
  {
    version: text('version').notNull(),
    detectedAt: text('detected_at').notNull(),
    direction: text('direction').notNull().$type<'added' | 'removed'>(),
    seq: integer('seq').notNull(),
    content: text('content').notNull(),
  },
  (table) => [
    primaryKey({
      columns: [table.version, table.detectedAt, table.direction, table.seq],
    }),
  ],
);

// doc_snippets は意図的に含めない(生の抜粋は LLM にとってノイズで、
// 156KB のファイルが D1 の SQL 文長上限 100KB に触れる)
export const settingsReference = sqliteTable('settings_reference', {
  key: text('key').primaryKey(),
  leafName: text('leaf_name'),
  slug: text('slug').notNull(),
  source: text('source').notNull().$type<'settings' | 'env'>(),
  descriptionEn: text('description_en').notNull(),
  descriptionJa: text('description_ja').notNull(),
  useCaseJa: text('use_case_ja'),
  // 値をキーにした JSON。公式リファレンスの選択肢ごとの英文を日本語にしたもの
  enumDescriptionsJa: text('enum_descriptions_ja'),
  defaultNoteJa: text('default_note_ja'),
  fetchedAt: text('fetched_at').notNull().default(''),
});

export const settingsOfficialDocs = sqliteTable(
  'settings_official_docs',
  {
    settingKey: text('setting_key').notNull(),
    docPath: text('doc_path').notNull(),
  },
  (table) => [primaryKey({ columns: [table.settingKey, table.docPath] })],
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
