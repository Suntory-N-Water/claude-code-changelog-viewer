declare const discordWebhookUrlBrand: unique symbol;

export type DiscordWebhookUrl = string & {
  readonly [discordWebhookUrlBrand]: unknown;
};

const DISCORD_WEBHOOK_REGEX =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function createDiscordWebhookUrl(value: string): DiscordWebhookUrl {
  if (!DISCORD_WEBHOOK_REGEX.test(value)) {
    throw new Error('Discord Webhook URL の形式が不正です');
  }

  return value as DiscordWebhookUrl;
}
