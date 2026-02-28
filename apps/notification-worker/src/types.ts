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
