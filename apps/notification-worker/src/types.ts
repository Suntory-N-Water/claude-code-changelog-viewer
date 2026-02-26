// D1 webhooks テーブルの行型
export type WebhookRow = {
  id: string;
  webhook_url: string;
  token: string;
  active: number;
  fail_count: number;
  created_at: string;
  updated_at: string;
};

// Cloudflare Queue に投入するメッセージ
export type NotificationMessage = {
  version: string;
};

// Discord Webhook API に POST するリクエストボディ
export type DiscordWebhookPayload = {
  content: string;
  username?: string;
  avatar_url?: string;
  flags?: number;
};
