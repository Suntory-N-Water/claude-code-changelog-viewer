import {
  DISCORD_BOT_AVATAR_URL,
  DISCORD_SUPPRESS_EMBEDS,
  type DiscordWebhookPayload,
  truncateForDiscord,
} from '@claude-code-changelog-viewer/common';
import type { Analysis } from '@claude-code-changelog-viewer/types';

const BOT_USERNAME = 'Claude Code Changelog Bot';

export function buildUnsubscribeUrl(workerUrl: string, token: string): string {
  return `${workerUrl}/api/unsubscribe?token=${token}`;
}

/**
 * 変更ログの通知メッセージを生成する
 */
export function createChangelogMessage(
  data: Analysis,
  version: string,
  unsubscribeUrl: string,
  siteUrl: string,
): DiscordWebhookPayload {
  const viewerUrl = `${siteUrl}/changelog/${version}/`;

  let content = `# Claude Code ${version} 🚀\n\n`;
  content += `## 全体サマリー\n${data.summary || 'Claude Codeの新しいバージョンがリリースされました。'}\n\n`;

  if (data.items.length > 0) {
    content += '## 更新内容\n';

    for (const item of data.items) {
      const translatedContent = item.content_ja || item.content;
      content += `**${translatedContent}**\n`;

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

  content += `## 参考\n- [更新内容の詳細](${viewerUrl})\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})`;
  content += `\n[🔕 通知を停止する](${unsubscribeUrl})`;

  const suffix = `...\n\n## 参考\n- [更新内容の詳細](${viewerUrl})\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})\n[🔕 通知を停止する](${unsubscribeUrl})`;
  content = truncateForDiscord(content, suffix);

  return {
    content,
    username: BOT_USERNAME,
    avatar_url: DISCORD_BOT_AVATAR_URL,
    flags: DISCORD_SUPPRESS_EMBEDS,
  };
}

export { sendToDiscord } from '@claude-code-changelog-viewer/common';

/**
 * 登録時のテスト通知メッセージを生成する
 */
export function createTestMessage(
  unsubscribeUrl: string,
): DiscordWebhookPayload {
  return {
    content:
      '✅ **Claude Code Changelog Bot** の通知登録が完了しました！\n\n' +
      '今後、Claude Code の新しいバージョンがリリースされると、このチャンネルに通知が届きます。' +
      `\n[🔕 通知を停止する](${unsubscribeUrl})`,
    username: BOT_USERNAME,
    avatar_url: DISCORD_BOT_AVATAR_URL,
    flags: DISCORD_SUPPRESS_EMBEDS,
  };
}
