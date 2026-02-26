const DISCORD_WEBHOOK_REGEX =
  /^https:\/\/discord\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export function isValidDiscordWebhookUrl(url: string): boolean {
  return DISCORD_WEBHOOK_REGEX.test(url);
}
