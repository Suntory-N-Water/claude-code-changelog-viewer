import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type { DiscordWebhookPayload } from './types';

type CliArgs = {
  version: string;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const version = args.find((arg) => !arg.startsWith('--'));

  if (!version) {
    console.error(
      'Usage: pnpm tsx src/discord/create-changelog-message.ts <version>',
    );
    console.error(
      'Example: pnpm tsx src/discord/create-changelog-message.ts v2.1.29',
    );
    process.exit(1);
  }

  return { version };
}

function createChangelogMessage(version: string): DiscordWebhookPayload {
  const inferredDir = join(process.cwd(), 'inferred');
  const inferredPath = join(inferredDir, `inferred_${version}.json`);

  const rawData = readFileSync(inferredPath, 'utf-8');
  const data = AnalysisSchema.parse(JSON.parse(rawData));

  // Markdown形式で内容を構築
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
  content += `## 参考\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})`;

  // Discordの文字数制限(2000文字)を考慮
  const MAX_CONTENT_LENGTH = 1950;
  if (content.length > MAX_CONTENT_LENGTH) {
    content = `${content.substring(0, MAX_CONTENT_LENGTH)}...\n\n## 参考\n- [公式リリースノート](https://github.com/anthropics/claude-code/releases/tag/${version})`;
  }

  return {
    content,
    username: 'Claude Code Changelog Bot',
    avatar_url:
      'https://claude-code-changelog-viewer.ayasnppk00.workers.dev/icon.png',
  };
}

async function sendToDiscord(
  webhookUrl: string,
  payload: DiscordWebhookPayload,
): Promise<void> {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Discord Webhook failed: ${response.status} ${response.statusText} - ${errorText}`,
    );
  }

  // Discord API rate limitを避けるため、1秒待機
  await new Promise((resolve) => setTimeout(resolve, 1000));
}

async function main(): Promise<void> {
  const { version } = parseArgs();
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';

  if (!webhookUrl) {
    console.error(
      '❌ Error: DISCORD_WEBHOOK_URL environment variable is required',
    );
    process.exit(1);
  }

  try {
    console.log(
      `📤 Creating and sending Discord notification for ${version}...`,
    );

    const payload = createChangelogMessage(version);
    await sendToDiscord(webhookUrl, payload);

    console.log('✅ Discord notification sent successfully');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
