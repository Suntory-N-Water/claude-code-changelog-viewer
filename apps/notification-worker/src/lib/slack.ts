import {
  getPrefixSortOrder,
  type Prefix,
} from '@claude-code-changelog-viewer/common';
import type { Analysis } from '@claude-code-changelog-viewer/types';

export type SlackSendResult = {
  ok: boolean;
  status: number;
};

type SlackBlock =
  | { type: 'header'; text: { type: 'plain_text'; text: string } }
  | { type: 'section'; text: { type: 'mrkdwn'; text: string } }
  | { type: 'divider' };

type SlackPayload = {
  text: string;
  blocks?: SlackBlock[];
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

export async function sendToSlack(
  webhookUrl: string,
  payload: SlackPayload,
): Promise<SlackSendResult> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return { ok: response.ok, status: response.status };
}

export function createSlackChangelogMessage(
  data: Analysis,
  version: string,
  options: { unsubscribeUrl: string; siteUrl: string },
): SlackPayload {
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
    const groupMap = new Map<string, typeof data.items>();
    for (const item of data.items) {
      const group = groupMap.get(item.prefix) ?? [];
      group.push(item);
      groupMap.set(item.prefix, group);
    }

    const sortedEntries = [...groupMap.entries()].sort(
      ([a], [b]) => getPrefixSortOrder(a) - getPrefixSortOrder(b),
    );

    for (const [prefix, items] of sortedEntries) {
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

export function createSlackTestMessage(unsubscribeUrl: string): SlackPayload {
  return {
    text: 'Claude Code Changelog Bot の通知登録が完了しました',
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text:
            ':white_check_mark: *Claude Code Changelog Bot* の通知登録が完了しました！\n\n' +
            '今後、Claude Code の新しいバージョンがリリースされると、このチャンネルに通知が届きます。\n\n' +
            `<${unsubscribeUrl}|:no_bell: 通知を停止する>`,
        },
      },
    ],
  };
}
