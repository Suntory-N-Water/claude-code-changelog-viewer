import { describe, expect, it } from 'vitest';
import type { Channel } from './channel';
import { createChannel, createChannelId } from './channel';
import { recordFailure, resetFailure } from './channel-failure';
import { reactivate } from './channel-lifecycle';
import { createChannelToken } from './channel-token';
import { createDiscordWebhookUrl } from './discord-webhook-url';
import { createEmailAddress } from './email-address';
import { createNotificationFrequency } from './notification-frequency';
import { createSlackWebhookUrl } from './slack-webhook-url';

function createDiscordChannel(
  overrides: Partial<Channel> = {},
): Extract<Channel, { type: 'DSC' }> {
  return {
    id: createChannelId('channel-id'),
    type: 'DSC',
    token: createChannelToken('channel-token'),
    notificationFrequency: createNotificationFrequency('IMM'),
    status: { type: 'active' },
    failCount: 0,
    webhookUrl: createDiscordWebhookUrl(
      'https://discord.com/api/webhooks/123456/abcdef',
    ),
    ...overrides,
  } as Extract<Channel, { type: 'DSC' }>;
}

describe('通知チャンネルの生成', () => {
  it.each([
    {
      label: 'Discord Webhook',
      address: {
        type: 'DSC' as const,
        value: createDiscordWebhookUrl(
          'https://discord.com/api/webhooks/123456/abcdef',
        ),
      },
      addressProperty: 'webhookUrl',
    },
    {
      label: 'Slack Webhook',
      address: {
        type: 'SLK' as const,
        value: createSlackWebhookUrl(
          'https://hooks.slack.com/services/ABC123/DEF456/token789',
        ),
      },
      addressProperty: 'webhookUrl',
    },
    {
      label: 'メールアドレス',
      address: {
        type: 'EML' as const,
        value: createEmailAddress('reader@example.com'),
      },
      addressProperty: 'emailAddress',
    },
  ])(
    '$label を登録するとき、有効な初期状態であること',
    ({ address, addressProperty }) => {
      const frequency = createNotificationFrequency('IMM');

      const channel = createChannel(address, frequency);

      expect(channel).toMatchObject({
        type: address.type,
        notificationFrequency: frequency,
        status: { type: 'active' },
        failCount: 0,
        [addressProperty]: address.value,
      });
      expect(channel.id).not.toBe('');
      expect(channel.token).not.toBe('');
    },
  );
});

describe('通知チャンネルの配信状態', () => {
  it('失敗回数が閾値未満のとき、有効なまま失敗回数だけが増えること', () => {
    const channel = createDiscordChannel({ failCount: 1 });

    const result = recordFailure(channel, new Date('2026-08-24T00:00:00.000Z'));

    expect(result).toEqual({ ...channel, failCount: 2 });
  });

  it('失敗回数が閾値に達したとき、指定日時にシステム停止されること', () => {
    const channel = createDiscordChannel({ failCount: 2 });
    const failedAt = new Date('2026-08-24T00:00:00.000Z');

    const result = recordFailure(channel, failedAt);

    expect(result).toEqual({
      ...channel,
      failCount: 3,
      status: {
        type: 'deactivated',
        reason: 'system',
        deactivatedAt: failedAt,
      },
    });
  });

  it('停止済みのとき、追加の失敗で状態が変わらないこと', () => {
    const channel = createDiscordChannel({
      failCount: 3,
      status: {
        type: 'deactivated',
        reason: 'system',
        deactivatedAt: new Date('2026-08-23T00:00:00.000Z'),
      },
    });

    const result = recordFailure(channel, new Date('2026-08-24T00:00:00.000Z'));

    expect(result).toEqual(channel);
  });

  it('送信に成功したとき、失敗回数が0に戻ること', () => {
    const channel = createDiscordChannel({ failCount: 2 });

    const result = resetFailure(channel);

    expect(result).toEqual({ ...channel, failCount: 0 });
  });

  it('システム停止済みのチャンネルを再開するとき、有効状態かつ失敗回数0になること', () => {
    const channel = createDiscordChannel({
      failCount: 3,
      status: {
        type: 'deactivated',
        reason: 'system',
        deactivatedAt: new Date('2026-08-23T00:00:00.000Z'),
      },
    });

    const result = reactivate(channel);

    expect(result).toEqual({
      ...channel,
      status: { type: 'active' },
      failCount: 0,
    });
  });
});

describe('通知先と通知頻度の検証', () => {
  it.each([
    {
      label: 'Discord Webhook URL',
      create: createDiscordWebhookUrl,
      valid: 'https://discord.com/api/webhooks/123456/abcdef-token',
      invalid: 'https://example.com/api/webhooks/123456/abcdef-token',
    },
    {
      label: 'Slack Webhook URL',
      create: createSlackWebhookUrl,
      valid: 'https://hooks.slack.com/services/ABC123/DEF456/token789',
      invalid: 'https://example.com/services/ABC123/DEF456/token789',
    },
    {
      label: 'メールアドレス',
      create: createEmailAddress,
      valid: 'reader@example.com',
      invalid: 'reader.example.com',
    },
    {
      label: '通知頻度',
      create: createNotificationFrequency,
      valid: 'WEK',
      invalid: 'DAILY',
    },
  ])(
    '$label が有効な形式のとき受理され、不正な形式のとき拒否されること',
    ({ create, valid, invalid }) => {
      expect(create(valid)).toBe(valid);
      expect(() => create(invalid)).toThrow();
    },
  );
});
