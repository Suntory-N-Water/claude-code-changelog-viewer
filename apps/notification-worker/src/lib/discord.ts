import {
  DISCORD_BOT_AVATAR_URL,
  DISCORD_SUPPRESS_EMBEDS,
  type DiscordWebhookPayload,
  getPrefixSortOrder,
  type Prefix,
  truncateForDiscord,
} from '@claude-code-changelog-viewer/common';
import type { Analysis } from '@claude-code-changelog-viewer/types';

const BOT_USERNAME = 'Claude Code Changelog Bot';

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

export function buildUnsubscribeUrl(workerUrl: string, token: string): string {
  return `${workerUrl}/api/unsubscribe?token=${token}`;
}

type CreateChangelogMessageOptions = {
  unsubscribeUrl: string;
  siteUrl: string;
};

/**
 * 変更ログの通知メッセージを生成する
 */
export function createChangelogMessage(
  data: Analysis,
  version: string,
  options: CreateChangelogMessageOptions,
): DiscordWebhookPayload {
  const { unsubscribeUrl, siteUrl } = options;
  const viewerUrl = `${siteUrl}/changelog/${version}/`;
  const footer = `\n## 参考\n- [更新内容の詳細](${viewerUrl})\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})\n[🔕 通知を停止する](${unsubscribeUrl})`;

  let content = `# Claude Code ${version} 🚀\n\n`;
  content += `${data.summary || 'Claude Codeの新しいバージョンがリリースされました。'}\n`;

  if (data.items.length > 0) {
    // prefix でグループ化
    const groupMap = new Map<string, typeof data.items>();
    for (const item of data.items) {
      const group = groupMap.get(item.prefix) ?? [];
      group.push(item);
      groupMap.set(item.prefix, group);
    }

    // PREFIX_ORDER に従ってソート、未定義 prefix は末尾
    const sortedEntries = [...groupMap.entries()].sort(
      ([a], [b]) => getPrefixSortOrder(a) - getPrefixSortOrder(b),
    );

    for (const [prefix, items] of sortedEntries) {
      const label = PREFIX_LABELS[prefix as Prefix] ?? prefix;
      content += `\n## ${label} (${items.length}件)\n`;
      for (const item of items) {
        content += `- ${item.content_ja || item.content}\n`;
      }
    }
  }

  const suffix = `...\n${footer}`;
  content = truncateForDiscord(content + footer, suffix);

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
