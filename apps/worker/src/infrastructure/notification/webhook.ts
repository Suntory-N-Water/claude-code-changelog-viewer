import { toError } from '@claude-code-changelog-viewer/common';
import { workerLogger } from '../../logger';

export type WebhookSendResult = {
  ok: boolean;
  status: number;
};

const logger = workerLogger('infrastructure.notification.webhook');

export async function postWebhook(
  webhookUrl: string,
  payload: unknown,
  channelType: 'DSC' | 'SLK',
): Promise<WebhookSendResult> {
  let response: Response;
  try {
    response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    logger.error('Webhook 通知の送信に失敗しました', {
      'notification.channel_type': channelType,
      error: toError(error),
    });
    throw error;
  }
  logger.info('Webhook 通知の送信結果を受信しました', {
    'notification.channel_type': channelType,
    'http.response.status_code': response.status,
  });
  return { ok: response.ok, status: response.status };
}
