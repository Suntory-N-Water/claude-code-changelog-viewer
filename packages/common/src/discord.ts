export type DiscordWebhookPayload = {
  content: string;
  username?: string;
  avatar_url?: string;
  flags?: number;
};

export const DISCORD_BOT_AVATAR_URL =
  'https://claude-code-log.com/icon.png' as const;

/** SUPPRESS_EMBEDS: リンクプレビュー(OGP)を非表示 */
export const DISCORD_SUPPRESS_EMBEDS = 1 << 2;

const DISCORD_MAX_LENGTH = 2000;

export function truncateForDiscord(content: string, suffix: string): string {
  if (content.length <= DISCORD_MAX_LENGTH) {
    return content;
  }
  return `${content.substring(0, DISCORD_MAX_LENGTH - suffix.length)}${suffix}`;
}
