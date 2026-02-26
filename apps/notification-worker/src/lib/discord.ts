import type { Analysis } from '@claude-code-changelog-viewer/types';
import type { DiscordWebhookPayload } from '../types';

/**
 * 変更ログの通知メッセージを生成する
 */
export function createChangelogMessage(
  data: Analysis,
  version: string,
  unsubscribeUrl: string,
): DiscordWebhookPayload {
  let content = `# Claude Code ${version} 🚀\n\n`;
  content += `## 全体サマリー\n${data.summary || 'Claude Codeの新しいバージョンがリリースされました。'}\n\n`;

  // 更新項目を追加
  if (data.items.length > 0) {
    content += '## 更新内容\n';

    for (const item of data.items) {
      const translatedContent = item.content_ja || item.content;
      content += `**${translatedContent}**\n`;

      // 推論情報がある場合は追加
      if (item.inference) {
        const { before, after, benefit } = item.inference;
        if (before) {
          content += `  - 変更前: ${before}\n`;
        }
        if (after) {
          content += `  - 変更後: ${after}\n`;
        }
        if (benefit) {
          content += `  - ユーザーへの恩恵: ${benefit}\n`;
        }
      }
    }
    content += '\n';
  }

  // 参考リンク
  const viewerUrl = `https://claude-code-changelog-viewer.ayasnppk00.workers.dev/changelog/${version}/`;
  content += `## 参考\n- [更新内容の詳細](${viewerUrl})\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})`;

  // 配信停止リンク
  content += `\n---\n[🔕 通知を停止する](${unsubscribeUrl})`;

  // Discordの文字数制限(2000文字)を考慮
  const DISCORD_MAX_LENGTH = 2000;
  if (content.length > DISCORD_MAX_LENGTH) {
    const suffix = `...\n\n## 参考\n- [更新内容の詳細](${viewerUrl})\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})\n---\n[🔕 通知を停止する](${unsubscribeUrl})`;
    content = `${content.substring(0, DISCORD_MAX_LENGTH - suffix.length)}${suffix}`;
  }

  return {
    content,
    username: 'Claude Code Changelog Bot',
    avatar_url:
      'https://claude-code-changelog-viewer.ayasnppk00.workers.dev/icon.png',
    flags: 1 << 2, // SUPPRESS_EMBEDS: リンクプレビュー(OGP)を非表示
  };
}

/**
 * Discord Webhook にメッセージを送信する
 */
export async function sendToDiscord(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<{ ok: boolean; status: number }> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: response.ok, status: response.status };
}

/**
 * 登録時のテスト通知メッセージを生成する
 */
export function createTestMessage(): DiscordWebhookPayload {
  return {
    content:
      '✅ **Claude Code Changelog Bot** の通知登録が完了しました！\n\n' +
      '今後、Claude Code の新しいバージョンがリリースされると、このチャンネルに通知が届きます。',
    username: 'Claude Code Changelog Bot',
    avatar_url:
      'https://claude-code-changelog-viewer.ayasnppk00.workers.dev/icon.png',
    flags: 1 << 2,
  };
}
