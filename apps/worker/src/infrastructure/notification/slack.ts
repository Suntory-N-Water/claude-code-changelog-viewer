import type { Prefix } from '@claude-code-changelog-viewer/common';
import type { NotificationAnalysis } from '@claude-code-changelog-viewer/types';
import { groupChangelogItemsByPrefix } from './changelog-message';

type SlackBlock =
  | { type: 'header'; text: { type: 'plain_text'; text: string } }
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'divider' };

type SlackPayload = {
  text: string;
  blocks?: SlackBlock[];
};

type SlackBlockPayload = SlackPayload & {
  blocks: SlackBlock[];
};

const PREFIX_LABELS: Record<Prefix, string> = {
  Breaking: ':rotating_light: 破壊的変更',
  Added: ':sparkles: 追加',
  Deprecated: ':warning: 非推奨',
  Changed: ':arrows_counterclockwise: 変更',
  Improved: ':chart_with_upwards_trend: 改善',
  Updated: ':arrow_up: 更新',
  Removed: ':wastebasket: 削除',
  Fixed: ':wrench: 修正',
  Enabled: ':white_check_mark: 有効化',
};

const SLACK_SECTION_MAX_LENGTH = 3000;

/** Slack向けの変更ログ通知メッセージを生成する。 */
export function createSlackChangelogMessage(
  data: NotificationAnalysis,
  version: string,
  options: { unsubscribeUrl: string; siteUrl: string },
): SlackBlockPayload {
  const { unsubscribeUrl, siteUrl } = options;
  const viewerUrl = `${siteUrl}/changelog/${version}/`;
  const summary =
    data.summary || 'Claude Code の新しいバージョンがリリースされました。';

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `Claude Code ${version} :rocket:` },
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: summary },
    },
  ];

  if (data.items.length > 0) {
    for (const { prefix, items } of groupChangelogItemsByPrefix(data.items)) {
      const label = PREFIX_LABELS[prefix as Prefix] ?? prefix;
      let sectionText = `*${label}* (${items.length}件)\n`;
      for (const item of items) {
        sectionText += `• ${item.content_ja || item.content}\n`;
      }
      if (sectionText.length > SLACK_SECTION_MAX_LENGTH) {
        sectionText = `${sectionText.substring(0, SLACK_SECTION_MAX_LENGTH - 3)}...`;
      }
      blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: sectionText },
      });
    }
  }

  blocks.push({ type: 'divider' });
  blocks.push({
    type: 'section',
    text: {
      type: 'mrkdwn',
      text: `<${viewerUrl}|更新内容の詳細> | <https://github.com/anthropics/claude-code/releases/tag/${version}|公式リリースノート> | <${unsubscribeUrl}|:no_bell: 通知を停止する>`,
    },
  });

  return {
    text: `Claude Code ${version} がリリースされました`,
    blocks,
  };
}

/** Slack向けの登録テスト通知メッセージを生成する。 */
export function createSlackTestMessage(unsubscribeUrl: string): SlackPayload {
  return {
    text: 'CCログ超訳 Bot の通知登録が完了しました',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            ':white_check_mark: *CCログ超訳 Bot* の通知登録が完了しました！\n\n' +
            '今後、Claude Code の新しいバージョンがリリースされると、このチャンネルに通知が届きます。\n\n' +
            `<${unsubscribeUrl}|:no_bell: 通知を停止する>`,
        },
      },
    ],
  };
}

/** Slack向けの通知停止完了メッセージを生成する。 */
export function createSlackUnsubscribeNotification(): SlackPayload {
  return {
    text: 'CCログ超訳 Bot の通知を停止しました',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            ':no_bell: *CCログ超訳 Bot* の通知を停止しました。\n\n' +
            'このチャンネルへの Claude Code 更新通知は今後送信されません。',
        },
      },
    ],
  };
}
