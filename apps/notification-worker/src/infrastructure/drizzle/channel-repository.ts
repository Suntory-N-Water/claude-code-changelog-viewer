import { and, eq, lt, sql } from 'drizzle-orm';
import { drizzle, type DrizzleD1Database } from 'drizzle-orm/d1';
import { CHANNEL_ACTIVE_SENTINEL } from '../../db/constants';
import {
  channels,
  discordChannels,
  emailChannels,
  notificationDeliveries,
  notificationSettings,
  slackChannels,
} from '../../db/schema';
import {
  type Channel,
  type ChannelId,
  type ChannelStatus,
  createChannelId,
} from '../../domain/channel/channel';
import {
  type ChannelToken,
  createChannelToken,
} from '../../domain/channel/channel-token';
import type {
  ChannelAddress,
  ChannelRepository,
} from '../../domain/channel/channel-repository';
import { createDiscordWebhookUrl } from '../../domain/channel/discord-webhook-url';
import { createEmailAddress } from '../../domain/channel/email-address';
import {
  type NotificationFrequency,
  createNotificationFrequency,
} from '../../domain/channel/notification-frequency';
import { createSlackWebhookUrl } from '../../domain/channel/slack-webhook-url';
import { decryptEmail, encryptEmail, hashEmail } from './email-crypto';

type CommonChannelRow = {
  readonly id: string;
  readonly channelType: 'DSC' | 'SLK' | 'EML';
  readonly token: string;
  readonly deactivatedAt: string;
  readonly deactivatedReason: 'none' | 'user' | 'system';
  readonly failCount: number;
  readonly frequency: 'IMM' | 'WEK';
};

/** Drizzle/D1を使ってChannelRepository portを実装する。 */
export class DrizzleChannelRepository implements ChannelRepository {
  constructor(
    private readonly db: DrizzleD1Database<Record<string, never>>,
    private readonly emailEncryptionKey: string,
  ) {}

  /** IDで共通行を取得し、Channel集約へ復元する。 */
  async findById(id: ChannelId): Promise<Channel | null> {
    const row = await this.findCommonChannel(eq(channels.id, id));
    return this.restoreChannel(row);
  }

  /** tokenで共通行を取得し、Channel集約へ復元する。 */
  async findByToken(token: ChannelToken): Promise<Channel | null> {
    const row = await this.findCommonChannel(eq(channels.token, token));
    return this.restoreChannel(row);
  }

  /** 通知先アドレスに対応するサブタイプテーブルからChannelを検索する。 */
  async findByAddress(address: ChannelAddress): Promise<Channel | null> {
    switch (address.type) {
      case 'DSC':
        return this.findByDiscordWebhookUrl(address.value);
      case 'SLK':
        return this.findBySlackWebhookUrl(address.value);
      case 'EML':
        return this.findByEmailAddress(address.value);
    }
  }

  /** Channel集約をスーパータイプ/サブタイプ/通知設定テーブルへ保存する。 */
  async save(channel: Channel): Promise<void> {
    const status = toPersistenceStatus(channel.status);

    await this.db
      .insert(channels)
      .values({
        id: channel.id,
        channelType: channel.type,
        token: channel.token,
        deactivatedAt: status.deactivatedAt,
        deactivatedReason: status.deactivatedReason,
        failCount: channel.failCount,
      })
      .onConflictDoUpdate({
        target: channels.id,
        set: {
          channelType: channel.type,
          token: channel.token,
          deactivatedAt: status.deactivatedAt,
          deactivatedReason: status.deactivatedReason,
          failCount: channel.failCount,
          updatedAt: sql`datetime('now')`,
        },
      });

    await this.saveNotificationSetting(channel);

    switch (channel.type) {
      case 'DSC':
        await this.saveDiscordChannel(channel);
        return;
      case 'SLK':
        await this.saveSlackChannel(channel);
        return;
      case 'EML':
        await this.saveEmailChannel(channel);
        return;
    }
  }

  /** 指定頻度の有効チャンネルを復元して返す。 */
  async findActiveByFrequency(
    frequency: NotificationFrequency,
  ): Promise<Channel[]> {
    const rows = await this.findCommonChannels(
      and(
        // CHANNEL_ACTIVE_SENTINEL は deactivated_at が「有効中」を示す番兵値。
        eq(channels.deactivatedAt, CHANNEL_ACTIVE_SENTINEL),
        eq(notificationSettings.frequency, frequency),
      ),
    );
    return this.restoreChannels(rows);
  }

  async hasDelivered(version: string, channelId: ChannelId): Promise<boolean> {
    const rows = await this.db
      .select({ version: notificationDeliveries.version })
      .from(notificationDeliveries)
      .where(
        and(
          eq(notificationDeliveries.version, version),
          eq(notificationDeliveries.channelId, channelId),
        ),
      );
    return rows.length > 0;
  }

  async recordDelivered(version: string, channelId: ChannelId): Promise<void> {
    await this.db
      .insert(notificationDeliveries)
      .values({ version, channelId })
      .onConflictDoNothing();
  }

  /** 指定日時より前に停止されたチャンネルを復元して返す。 */
  async findDeactivatedBefore(date: Date): Promise<Channel[]> {
    const rows = await this.findCommonChannels(
      lt(channels.deactivatedAt, toSqlDateTime(date)),
    );
    return this.restoreChannels(rows);
  }

  /** Channel集約に対応する全テーブルの行を削除する。 */
  async delete(id: ChannelId): Promise<void> {
    await this.db.batch([
      this.db
        .delete(notificationDeliveries)
        .where(eq(notificationDeliveries.channelId, id)),
      this.db.delete(discordChannels).where(eq(discordChannels.channelId, id)),
      this.db.delete(slackChannels).where(eq(slackChannels.channelId, id)),
      this.db.delete(emailChannels).where(eq(emailChannels.channelId, id)),
      this.db
        .delete(notificationSettings)
        .where(eq(notificationSettings.channelId, id)),
      this.db.delete(channels).where(eq(channels.id, id)),
    ]);
  }

  /** Discord Webhook URLから対応するチャンネルIDを引き、Channel集約を復元する。 */
  private async findByDiscordWebhookUrl(
    webhookUrl: string,
  ): Promise<Channel | null> {
    const rows = await this.db
      .select({ channelId: discordChannels.channelId })
      .from(discordChannels)
      .where(eq(discordChannels.webhookUrl, webhookUrl));
    const row = rows[0] ?? null;
    if (!row) {
      return null;
    }

    return this.findById(createChannelId(row.channelId));
  }

  /** Slack Webhook URLから対応するチャンネルIDを引き、Channel集約を復元する。 */
  private async findBySlackWebhookUrl(
    webhookUrl: string,
  ): Promise<Channel | null> {
    const rows = await this.db
      .select({ channelId: slackChannels.channelId })
      .from(slackChannels)
      .where(eq(slackChannels.webhookUrl, webhookUrl));
    const row = rows[0] ?? null;
    if (!row) {
      return null;
    }

    return this.findById(createChannelId(row.channelId));
  }

  /** EmailアドレスのHMACハッシュから対応するチャンネルIDを引き、Channel集約を復元する。 */
  private async findByEmailAddress(
    emailAddress: string,
  ): Promise<Channel | null> {
    // メールは平文保存しない。検索には HMAC ハッシュ、送信時には暗号化済み本文の復号を使う。
    const emailHash = await hashEmail(emailAddress, this.emailEncryptionKey);
    const rows = await this.db
      .select({ channelId: emailChannels.channelId })
      .from(emailChannels)
      .where(eq(emailChannels.emailHash, emailHash));
    const row = rows[0] ?? null;
    if (!row) {
      return null;
    }

    return this.findById(createChannelId(row.channelId));
  }

  /** 1件取得用の共通行取得ヘルパー。 */
  private async findCommonChannel(
    where: ReturnType<typeof eq>,
  ): Promise<CommonChannelRow | null> {
    const rows = await this.findCommonChannels(where);
    return rows[0] ?? null;
  }

  /**
   * channels と notification_settings だけをJOINし、全チャンネル共通の永続化行を取得する。
   * サブタイプ固有値は restoreChannel で channel_type に応じて追加取得する。
   */
  private async findCommonChannels(
    where:
      | ReturnType<typeof and>
      | ReturnType<typeof eq>
      | ReturnType<typeof lt>,
  ): Promise<CommonChannelRow[]> {
    return this.db
      .select({
        id: channels.id,
        channelType: channels.channelType,
        token: channels.token,
        deactivatedAt: channels.deactivatedAt,
        deactivatedReason: channels.deactivatedReason,
        failCount: channels.failCount,
        frequency: notificationSettings.frequency,
      })
      .from(channels)
      .innerJoin(
        notificationSettings,
        eq(notificationSettings.channelId, channels.id),
      )
      .where(where);
  }

  /**
   * 複数の永続化行をドメインの Channel 集約へ復元する。
   * サブタイプ行が欠けている不整合データは復元できないため除外する。
   */
  private async restoreChannels(rows: CommonChannelRow[]): Promise<Channel[]> {
    const result: Channel[] = [];
    for (const row of rows) {
      const channel = await this.restoreChannel(row);
      if (channel) {
        result.push(channel);
      }
    }

    return result;
  }

  /**
   * channels の共通行と各サブタイプテーブルの行から、ドメインの Channel 集約を復元する。
   * 共通行がない、または対応するサブタイプ行がない場合は null を返す。
   */
  private async restoreChannel(
    row: CommonChannelRow | null,
  ): Promise<Channel | null> {
    if (!row) {
      return null;
    }

    const base = {
      id: createChannelId(row.id),
      token: createChannelToken(row.token),
      notificationFrequency: createNotificationFrequency(row.frequency),
      status: toDomainStatus(row),
      failCount: row.failCount,
    } as const;

    switch (row.channelType) {
      case 'DSC': {
        const rows = await this.db
          .select({ webhookUrl: discordChannels.webhookUrl })
          .from(discordChannels)
          .where(eq(discordChannels.channelId, row.id));
        const subtype = rows[0] ?? null;
        if (!subtype) {
          return null;
        }

        return {
          ...base,
          type: 'DSC',
          webhookUrl: createDiscordWebhookUrl(subtype.webhookUrl),
        };
      }
      case 'SLK': {
        const rows = await this.db
          .select({ webhookUrl: slackChannels.webhookUrl })
          .from(slackChannels)
          .where(eq(slackChannels.channelId, row.id));
        const subtype = rows[0] ?? null;
        if (!subtype) {
          return null;
        }

        return {
          ...base,
          type: 'SLK',
          webhookUrl: createSlackWebhookUrl(subtype.webhookUrl),
        };
      }
      case 'EML': {
        const rows = await this.db
          .select({ emailEncrypted: emailChannels.emailEncrypted })
          .from(emailChannels)
          .where(eq(emailChannels.channelId, row.id));
        const subtype = rows[0] ?? null;
        if (!subtype) {
          return null;
        }

        // メールは平文保存しない。送信用のドメインモデル復元時のみ復号する。
        const emailAddress = await decryptEmail(
          subtype.emailEncrypted,
          this.emailEncryptionKey,
        );

        return {
          ...base,
          type: 'EML',
          emailAddress: createEmailAddress(emailAddress),
        };
      }
    }
  }

  /** Channel集約内の通知頻度を notification_settings に保存する。 */
  private async saveNotificationSetting(channel: Channel): Promise<void> {
    await this.db
      .insert(notificationSettings)
      .values({
        id: `ns_${channel.id}`,
        channelId: channel.id,
        frequency: channel.notificationFrequency,
      })
      .onConflictDoUpdate({
        target: notificationSettings.id,
        set: {
          frequency: channel.notificationFrequency,
        },
      });
  }

  /** Discord 固有の通知先を discord_channels に保存する。 */
  private async saveDiscordChannel(channel: Extract<Channel, { type: 'DSC' }>) {
    await this.db
      .insert(discordChannels)
      .values({ channelId: channel.id, webhookUrl: channel.webhookUrl })
      .onConflictDoUpdate({
        target: discordChannels.channelId,
        set: { webhookUrl: channel.webhookUrl },
      });
  }

  /** Slack 固有の通知先を slack_channels に保存する。 */
  private async saveSlackChannel(channel: Extract<Channel, { type: 'SLK' }>) {
    await this.db
      .insert(slackChannels)
      .values({ channelId: channel.id, webhookUrl: channel.webhookUrl })
      .onConflictDoUpdate({
        target: slackChannels.channelId,
        set: { webhookUrl: channel.webhookUrl },
      });
  }

  /** Email 固有の通知先を email_channels に保存する。 */
  private async saveEmailChannel(channel: Extract<Channel, { type: 'EML' }>) {
    // メールは平文保存しない。検索用に HMAC ハッシュ、送信用に暗号化済み本文を保存する。
    const emailHash = await hashEmail(
      channel.emailAddress,
      this.emailEncryptionKey,
    );
    const emailEncrypted = await encryptEmail(
      channel.emailAddress,
      this.emailEncryptionKey,
    );

    await this.db
      .insert(emailChannels)
      .values({ channelId: channel.id, emailHash, emailEncrypted })
      .onConflictDoUpdate({
        target: emailChannels.channelId,
        set: { emailHash, emailEncrypted },
      });
  }
}

/** D1 binding から ChannelRepository port のDrizzle実装を作成する。 */
export function createChannelRepository(
  binding: D1Database,
  emailEncryptionKey: string,
): ChannelRepository {
  return new DrizzleChannelRepository(drizzle(binding), emailEncryptionKey);
}

/** DBの deactivated_at / deactivated_reason をドメインの状態表現へ変換する。 */
function toDomainStatus(row: CommonChannelRow): ChannelStatus {
  if (row.deactivatedAt === CHANNEL_ACTIVE_SENTINEL) {
    return { type: 'active' };
  }

  return {
    type: 'deactivated',
    reason: row.deactivatedReason === 'system' ? 'system' : 'user',
    deactivatedAt: fromSqlDateTime(row.deactivatedAt),
  };
}

/** ドメインの状態表現をDBの deactivated_at / deactivated_reason へ変換する。 */
function toPersistenceStatus(status: ChannelStatus): {
  readonly deactivatedAt: string;
  readonly deactivatedReason: 'none' | 'user' | 'system';
} {
  if (status.type === 'active') {
    return {
      // CHANNEL_ACTIVE_SENTINEL は deactivated_at が「有効中」を示す番兵値。
      deactivatedAt: CHANNEL_ACTIVE_SENTINEL,
      deactivatedReason: 'none',
    };
  }

  return {
    deactivatedAt: toSqlDateTime(status.deactivatedAt),
    deactivatedReason: status.reason,
  };
}

/** SQLite に保存する日時文字列へ変換する。 */
function toSqlDateTime(date: Date): string {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/** SQLite から取得した日時文字列を Date に戻す。 */
function fromSqlDateTime(value: string): Date {
  return new Date(`${value.replace(' ', 'T')}Z`);
}
