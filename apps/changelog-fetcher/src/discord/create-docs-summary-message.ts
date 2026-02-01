import { execSync } from 'node:child_process';
import { GeminiClient } from '../ai/gemini-client';
import type { DiscordWebhookPayload } from './types';

type CliArgs = {
  commitSha: string;
  changedFilesCount: number;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  // コミットSHAの取得（第1引数 or --commit-sha）
  const commitShaIndex = args.indexOf('--commit-sha');
  const commitSha =
    commitShaIndex !== -1
      ? args[commitShaIndex + 1]
      : args.find((arg) => !arg.startsWith('--'));

  // 変更ファイル数の取得（--changed-files）
  const changedFilesIndex = args.indexOf('--changed-files');
  const changedFilesCount =
    changedFilesIndex !== -1
      ? Number.parseInt(args[changedFilesIndex + 1], 10)
      : 0;

  if (!commitSha) {
    console.error(
      'Usage: pnpm tsx src/discord/create-docs-summary-message.ts <commit-sha> --changed-files <count>',
    );
    console.error(
      'Example: pnpm tsx src/discord/create-docs-summary-message.ts abc123 --changed-files 5',
    );
    process.exit(1);
  }

  return { commitSha, changedFilesCount };
}

/**
 * git diffを取得（HEAD~1との差分、docs/配下のみ）
 */
function getDocsDiff(commitSha: string): string {
  try {
    // Check if parent commit exists
    try {
      execSync(`git rev-parse ${commitSha}~1`, { encoding: 'utf-8' });
    } catch {
      // First commit - return empty diff
      return 'Initial commit - all files are new';
    }

    // Get diff for docs directory only
    const diff = execSync(
      `git diff ${commitSha}~1 ${commitSha} -- apps/docs-tracker/docs/`,
      {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB
      },
    );

    // Limit diff size to avoid token overflow (first 3000 lines)
    const lines = diff.split('\n');
    if (lines.length > 3000) {
      return `${lines.slice(0, 3000).join('\n')}\n\n... (diff truncated, ${lines.length - 3000} lines omitted)`;
    }

    return diff || 'No changes in docs directory';
  } catch (error) {
    console.error('Failed to get git diff:', error);
    return 'Failed to retrieve git diff';
  }
}

/**
 * git diffから変更ファイル一覧を取得
 */
function getChangedFilesList(commitSha: string): string {
  try {
    // Check if parent commit exists
    try {
      execSync(`git rev-parse ${commitSha}~1`, { encoding: 'utf-8' });
    } catch {
      return 'Initial commit';
    }

    const files = execSync(
      `git diff ${commitSha}~1 ${commitSha} --name-only -- apps/docs-tracker/docs/`,
      {
        encoding: 'utf-8',
      },
    );

    const fileList = files
      .trim()
      .split('\n')
      .filter((f) => f)
      .map((f) => `• ${f.replace('apps/docs-tracker/docs/', '')}`)
      .slice(0, 15);

    if (files.split('\n').length > 15) {
      const remaining = files.split('\n').length - 15;
      fileList.push(`... and ${remaining} more files`);
    }

    return fileList.join('\n') || 'No files changed';
  } catch (error) {
    console.error('Failed to get changed files:', error);
    return 'Failed to retrieve file list';
  }
}

/**
 * Geminiでドキュメントのdiffを要約
 */
async function summarizeDocChanges(
  client: GeminiClient,
  diff: string,
  changedFilesCount: number,
): Promise<string> {
  const prompt = `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタント CLI ツールである
- 公式ドキュメントが更新された
- 開発者は変更の概要を素早く把握したい

## 状況 (Situation)
- 変更ファイル数: ${changedFilesCount}
- Git diff:
\`\`\`diff
${diff}
\`\`\`

## 目的 (Purpose)
このドキュメント変更の要約を日本語で作成する。
開発者が「何が変わったか」を一目で理解できる簡潔な要約を提供する。

## 動機 (Motive)
技術的な詳細よりも、開発者にとって重要な情報を伝える。
新機能の追加、既存機能の変更、重要な注意事項などを優先的に言及する。

## 制約 (Constraint)
- 3-5文で簡潔にまとめる
- 主要な変更点、新機能、重要な修正を優先的に言及
- 技術用語は適切に日本語化
- 「です・ます」調で統一
- 要約テキストのみを出力し、説明や追加情報は不要

# 出力形式
要約テキストのみを出力してください。
`;

  try {
    const summary = await client.generateVersionSummary(prompt);
    return summary;
  } catch (error) {
    console.error('Failed to generate AI summary:', error);
    // フォールバック: 簡易メッセージ
    return `Claude Code のドキュメントが更新されました（${changedFilesCount}ファイル）。詳細はコミットをご確認ください。`;
  }
}

/**
 * Discord Webhook用のメッセージを生成
 */
function createDiscordMessage(
  commitSha: string,
  changedFilesCount: number,
  fileList: string,
  summary: string,
): DiscordWebhookPayload {
  const commitUrl = `https://github.com/ayasamind/claude-code-changelog-viewer/commit/${commitSha}`;
  const repoUrl = 'https://github.com/ayasamind/claude-code-changelog-viewer';

  let content = '# 📝 Claude Code ドキュメント更新\n\n';
  content += `## 変更概要\n${changedFilesCount}件のドキュメントが更新されました\n\n`;
  content += `## AI要約\n${summary}\n\n`;
  content += `## 変更ファイル\n\`\`\`\n${fileList}\n\`\`\`\n\n`;
  content += `## 参考\n- [コミット](${commitUrl})\n- [リポジトリ](${repoUrl})`;

  // Discordの文字数制限（2000文字）を考慮
  const MAX_CONTENT_LENGTH = 1950;
  if (content.length > MAX_CONTENT_LENGTH) {
    content = `${content.substring(0, MAX_CONTENT_LENGTH)}...\n\n## 参考\n- [コミット](${commitUrl})`;
  }

  return {
    content,
    username: 'Claude Code Docs Bot',
    avatar_url:
      'https://claude-code-changelog-viewer.ayasnppk00.workers.dev/icon.png',
  };
}

/**
 * Discord Webhookへ送信
 */
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

  console.log('✅ Discord notification sent successfully');
}

async function main(): Promise<void> {
  const { commitSha, changedFilesCount } = parseArgs();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';

  if (!webhookUrl) {
    console.error(
      '❌ Error: DISCORD_WEBHOOK_URL environment variable is required',
    );
    process.exit(1);
  }

  if (!geminiApiKey) {
    console.error('❌ Error: GEMINI_API_KEY environment variable is required');
    process.exit(1);
  }

  try {
    console.log(`📤 Creating Discord notification for commit ${commitSha}...`);
    console.log(`   Changed files: ${changedFilesCount}`);

    // 1. git diff取得
    const diff = getDocsDiff(commitSha);
    console.log(`✓ Retrieved git diff (${diff.length} chars)`);

    // 2. 変更ファイル一覧取得
    const fileList = getChangedFilesList(commitSha);
    console.log('✓ Retrieved changed files list');

    // 3. AI要約生成
    console.log('🤖 Generating AI summary with Gemini...');
    const client = new GeminiClient(geminiApiKey);
    const summary = await summarizeDocChanges(client, diff, changedFilesCount);
    console.log('✓ AI summary generated');

    // 4. Discordメッセージ生成
    const payload = createDiscordMessage(
      commitSha,
      changedFilesCount,
      fileList,
      summary,
    );
    console.log(`✓ Discord message created (${payload.content.length} chars)`);

    // 5. Discord送信
    await sendToDiscord(webhookUrl, payload);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
