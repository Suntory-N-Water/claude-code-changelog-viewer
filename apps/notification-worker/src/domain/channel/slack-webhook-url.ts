declare const slackWebhookUrlBrand: unique symbol;

export type SlackWebhookUrl = string & {
  readonly [slackWebhookUrlBrand]: unknown;
};

const SLACK_WEBHOOK_REGEX =
  /^https:\/\/hooks\.slack\.com\/services\/[A-Z0-9]+\/[A-Z0-9]+\/[A-Za-z0-9]+$/;

export function createSlackWebhookUrl(value: string): SlackWebhookUrl {
  if (!SLACK_WEBHOOK_REGEX.test(value)) {
    throw new Error('Slack Webhook URL の形式が不正です');
  }

  return value as SlackWebhookUrl;
}
