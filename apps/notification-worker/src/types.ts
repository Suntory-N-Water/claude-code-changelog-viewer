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

// Discord Webhook API に POST するリクエストボディ
export type DiscordWebhookPayload = {
  content: string;
  username?: string;
  avatar_url?: string;
  flags?: number;
};
