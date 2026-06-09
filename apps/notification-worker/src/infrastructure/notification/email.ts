// biome-ignore lint/correctness/noUnresolvedImports: Cloudflare Workers ランタイム組み込みモジュール
import { EmailMessage } from 'cloudflare:email';
import type { Prefix } from '@claude-code-changelog-viewer/common';
import type { Analysis } from '@claude-code-changelog-viewer/types';
import { createMimeMessage } from 'mimetext';
import { groupChangelogItemsByPrefix } from './changelog-message';

export type EmailSendResult = {
  ok: boolean;
  status: number;
};

type EmailPayload = {
  subject: string;
  html: string;
  text: string;
};

const PREFIX_LABELS: Record<Prefix, string> = {
  Breaking: '🚨 破壊的変更',
  Added: '✨ 追加',
  Deprecated: '⚠️ 非推奨',
  Changed: '🔄 変更',
  Improved: '📈 改善',
  Updated: '⬆️ 更新',
  Removed: '🗑️ 削除',
  Fixed: '🔧 修正',
  Enabled: '✅ 有効化',
};

/** Cloudflare Email Bindingでメールを送信する。 */
export async function sendToEmail(
  sendEmail: SendEmail,
  options: { fromAddress: string; toAddress: string; payload: EmailPayload },
): Promise<EmailSendResult> {
  const { fromAddress, toAddress, payload } = options;
  const msg = createMimeMessage();
  msg.setSender({ name: 'CCログ超訳', addr: fromAddress });
  msg.setRecipient(toAddress);
  msg.setSubject(payload.subject);
  msg.addMessage({ contentType: 'text/plain', data: payload.text });
  msg.addMessage({ contentType: 'text/html', data: payload.html });

  const message = new EmailMessage(fromAddress, toAddress, msg.asRaw());
  await sendEmail.send(message);
  return { ok: true, status: 200 };
}

/** Email向けの変更ログ通知メッセージを生成する。 */
export function createEmailChangelogMessage(
  data: Analysis,
  version: string,
  options: { unsubscribeUrl: string; siteUrl: string },
): EmailPayload {
  const { unsubscribeUrl, siteUrl } = options;
  const viewerUrl = `${siteUrl}/changelog/${version}/`;
  const summary =
    data.summary || 'Claude Code の新しいバージョンがリリースされました。';

  const groups = groupChangelogItemsByPrefix(data.items);

  const sectionsHtml = groups
    .map(({ prefix, items }) => {
      const label = PREFIX_LABELS[prefix as Prefix] ?? prefix;
      const listItems = items
        .map((item) => `<li>${item.content_ja || item.content}</li>`)
        .join('');
      return `<h3 style="margin:16px 0 8px">${label} (${items.length}件)</h3><ul style="margin:0;padding-left:20px">${listItems}</ul>`;
    })
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin-bottom:8px">🚀 Claude Code ${version}</h1>
  <p style="color:#555;margin-bottom:16px">${summary}</p>
  ${sectionsHtml}
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5">
  <p style="font-size:13px;color:#888">
    <a href="${viewerUrl}" style="color:#e87040">更新内容の詳細</a> ·
    <a href="https://github.com/anthropics/claude-code/releases/tag/${version}" style="color:#e87040">公式リリースノート</a> ·
    <a href="${unsubscribeUrl}" style="color:#888">通知を停止する</a>
  </p>
</body>
</html>`;

  const sectionsText = groups
    .map(({ prefix, items }) => {
      const label = PREFIX_LABELS[prefix as Prefix] ?? prefix;
      const lines = items
        .map((item) => `  - ${item.content_ja || item.content}`)
        .join('\n');
      return `${label} (${items.length}件)\n${lines}`;
    })
    .join('\n\n');

  const text = `Claude Code ${version} がリリースされました

${summary}

${sectionsText}

---
更新内容の詳細: ${viewerUrl}
公式リリースノート: https://github.com/anthropics/claude-code/releases/tag/${version}
通知を停止する: ${unsubscribeUrl}`;

  return {
    subject: `Claude Code ${version} がリリースされました`,
    html,
    text,
  };
}

/** Email向けの登録テスト通知メッセージを生成する。 */
export function createEmailTestMessage(unsubscribeUrl: string): EmailPayload {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin-bottom:8px">✅ 通知登録が完了しました</h1>
  <p style="color:#555">CCログ超訳 の更新通知登録が完了しました。</p>
  <p style="color:#555">今後、Claude Code の新しいバージョンがリリースされると、このメールアドレスに通知が届きます。</p>
  <hr style="margin:24px 0;border:none;border-top:1px solid #e5e5e5">
  <p style="font-size:13px;color:#888">
    <a href="${unsubscribeUrl}" style="color:#888">通知を停止する</a>
  </p>
</body>
</html>`;

  const text = `通知登録が完了しました

CCログ超訳 の更新通知登録が完了しました。
今後、Claude Code の新しいバージョンがリリースされると、このメールアドレスに通知が届きます。

---
通知を停止する: ${unsubscribeUrl}`;

  return {
    subject: 'CCログ超訳 通知登録が完了しました',
    html,
    text,
  };
}

/** Email向けの通知停止完了メッセージを生成する。 */
export function createEmailUnsubscribeNotification(): EmailPayload {
  const html = `<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h1 style="font-size:20px;margin-bottom:8px">🔕 通知を停止しました</h1>
  <p style="color:#555">CCログ超訳 の更新通知を停止しました。</p>
  <p style="color:#555">このメールアドレスへの Claude Code 更新通知は今後送信されません。</p>
</body>
</html>`;

  const text = `通知を停止しました

CCログ超訳 の更新通知を停止しました。
このメールアドレスへの Claude Code 更新通知は今後送信されません。`;

  return {
    subject: 'CCログ超訳 通知停止のお知らせ',
    html,
    text,
  };
}
