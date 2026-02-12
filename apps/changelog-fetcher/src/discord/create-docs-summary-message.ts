import { execSync } from 'node:child_process';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { GeminiClient } from '../ai/gemini-client';
import type { DiscordWebhookPayload } from './types';

const log = getLogger({ name: 'discord-docs' });

type CliArgs = {
  commitSha: string;
  changedFilesCount: number;
};

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);

  // コミットSHAの取得(第1引数 or --commit-sha)
  const commitShaIndex = args.indexOf('--commit-sha');
  const commitSha =
    commitShaIndex !== -1
      ? args[commitShaIndex + 1]
      : args.find((arg) => !arg.startsWith('--'));

  // 変更ファイル数の取得(--changed-files)
  const changedFilesIndex = args.indexOf('--changed-files');
  const changedFilesCount =
    changedFilesIndex !== -1
      ? Number.parseInt(args[changedFilesIndex + 1], 10)
      : 0;

  if (!commitSha) {
    log.error(
      'Usage: pnpm tsx src/discord/create-docs-summary-message.ts <commit-sha> --changed-files <count>',
    );
    process.exit(1);
  }

  return { commitSha, changedFilesCount };
}

/**
 * git diffを取得(HEAD~1との差分、docs/配下のみ)
 */
function getDocsDiff(commitSha: string): string {
  try {
    // Check if parent commit exists
    try {
      const parentCheck = execSync(`git rev-parse ${commitSha}~1`, {
        encoding: 'utf-8',
      });
      log.info(`親コミットを確認: ${parentCheck.trim()}`);
    } catch {
      // First commit - return empty diff
      log.info('親コミットなし - 初回コミット');
      return 'Initial commit - all files are new';
    }

    // Get repository root to ensure correct path resolution
    const repoRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    }).trim();

    // Get diff for docs directory only, excluding metadata files like changelog.md
    // Focus on actual documentation content changes
    // Use absolute path from repo root to avoid path resolution issues
    const diffCommand = `git diff ${commitSha}~1 ${commitSha} -- '${repoRoot}/apps/docs-tracker/docs/**/*.md' ':(exclude)${repoRoot}/apps/docs-tracker/docs/**/changelog.md'`;
    log.debug(`diff コマンド実行: ${diffCommand}`);

    const diff = execSync(diffCommand, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024, // 10MB
      cwd: repoRoot, // Execute from repo root for consistent behavior
    });

    log.info(`diff 取得完了: ${diff.length} 文字`);

    // If diff is empty or very small, it might be only metadata changes
    if (diff.length < 100) {
      log.warn(
        'diff が非常に小さいため、メタデータのみの変更の可能性があります',
      );
      // Fall back to showing changed file names with their full content context
      return 'Minimal diff detected - changes may be metadata only';
    }

    // Limit diff size to avoid token overflow (first 3000 lines)
    const lines = diff.split('\n');
    if (lines.length > 3000) {
      return `${lines.slice(0, 3000).join('\n')}\n\n... (diff truncated, ${lines.length - 3000} lines omitted)`;
    }

    return diff || 'No changes in docs directory';
  } catch (error) {
    if (error instanceof Error) {
      log.error('git diff の取得に失敗', error);
    }
    return 'Failed to retrieve git diff';
  }
}

/**
 * git diffから変更ファイル一覧を取得(GitHubリンク付き)
 */
function getChangedFilesList(
  commitSha: string,
  repoOwner = 'Suntory-N-Water',
  repoName = 'claude-code-changelog-viewer',
): string {
  try {
    // Check if parent commit exists
    try {
      execSync(`git rev-parse ${commitSha}~1`, { encoding: 'utf-8' });
    } catch {
      return 'Initial commit';
    }

    // Get repository root to ensure correct path resolution
    const repoRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
    }).trim();

    // Exclude changelog.md to focus on actual doc changes
    // Use absolute path from repo root to avoid path resolution issues
    const files = execSync(
      `git diff ${commitSha}~1 ${commitSha} --name-only -- '${repoRoot}/apps/docs-tracker/docs/**/*.md' ':(exclude)${repoRoot}/apps/docs-tracker/docs/**/changelog.md'`,
      {
        encoding: 'utf-8',
        cwd: repoRoot, // Execute from repo root for consistent behavior
      },
    );

    log.info(`変更ファイル一覧:\n${files}`);

    const fileArray = files
      .trim()
      .split('\n')
      .filter((f) => f);

    if (fileArray.length === 0) {
      return 'No files changed (excluding changelog.md)';
    }

    const fileList = fileArray.slice(0, 15).map((f) => {
      const displayPath = f.replace('apps/docs-tracker/docs/', '');
      const githubUrl = `https://github.com/${repoOwner}/${repoName}/blob/${commitSha}/${f}`;
      return `• [${displayPath}](${githubUrl})`;
    });

    if (fileArray.length > 15) {
      const remaining = fileArray.length - 15;
      fileList.push(`... and ${remaining} more files`);
    }

    return fileList.join('\n');
  } catch (error) {
    if (error instanceof Error) {
      log.error('変更ファイル一覧の取得に失敗', error);
    } else {
      log.error('変更ファイル一覧の取得に失敗');
    }
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
  commitSha: string,
): Promise<string> {
  // diffが極端に小さい場合は、変更ファイルの主要な変更箇所を抽出
  let enrichedContext = diff;

  if (diff.length < 100) {
    log.warn('diff が小さいため、ファイルコンテキストを抽出します');

    try {
      // Get repository root to ensure correct path resolution
      const repoRoot = execSync('git rev-parse --show-toplevel', {
        encoding: 'utf-8',
      }).trim();

      // 変更されたファイルの具体的な差分を取得(HTMLメタデータを除外)
      const detailedDiff = execSync(
        `git diff ${commitSha}~1 ${commitSha} -- '${repoRoot}/apps/docs-tracker/docs/**/*.md' ':(exclude)${repoRoot}/apps/docs-tracker/docs/**/changelog.md' | grep -A 3 -B 3 '^[+-]' | grep -v '^index\\|^diff\\|^---\\|^+++'`,
        {
          encoding: 'utf-8',
          maxBuffer: 5 * 1024 * 1024,
          cwd: repoRoot, // Execute from repo root for consistent behavior
        },
      ).trim();

      if (detailedDiff) {
        enrichedContext = detailedDiff;
        log.info(`詳細コンテキスト抽出完了: ${enrichedContext.length} 文字`);
      }
    } catch {
      log.info('詳細コンテキストの抽出に失敗、元の diff を使用');
    }
  }

  const prompt = `
# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタント CLI ツールである
- 公式ドキュメントが更新された
- 開発者は変更の概要を素早く把握したい

## 状況 (Situation)
- 変更ファイル数: ${changedFilesCount}
- 変更内容の差分:
\`\`\`diff
${enrichedContext}
\`\`\`

## 目的 (Purpose)
このドキュメント変更の要約を日本語で作成する。
開発者が「何が具体的に変わったか」を一目で理解できる要約を提供する。

## 動機 (Motive)
抽象的な説明ではなく、具体的な変更内容を伝える。
例: 「ドキュメントが更新されました」ではなく「hooks.mdでJSONレスポンス形式がdecisionからpermissionDecisionに変更されました」のように具体的に記述する。
新機能の追加、既存機能の変更、APIの変更、新しい設定オプションなどを優先的に言及する。

## 制約 (Constraint)
- 3-5文で簡潔にまとめる
- 具体的なファイル名や変更内容を含める
- 技術用語は適切に日本語化
- 「です・ます」調で統一
- 要約テキストのみを出力し、説明や追加情報は不要

# 出力形式
要約テキストのみを出力してください。
`;

  try {
    const summary = await client.generateText(prompt);
    return summary;
  } catch (error) {
    if (error instanceof Error) {
      log.error('AI要約の生成に失敗', error);
    } else {
      log.error('AI要約の生成に失敗');
    }
    // フォールバック: 簡易メッセージ
    return `Claude Code のドキュメントが更新されました(${changedFilesCount}ファイル)。詳細はコミットをご確認ください。`;
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
  const commitUrl = `https://github.com/Suntory-N-Water/claude-code-changelog-viewer/commit/${commitSha}`;

  let content = '# 📝 Claude Code ドキュメント更新\n\n';
  content += `## 変更概要\n${changedFilesCount}件のドキュメントが更新されました\n\n`;
  content += `## AI要約\n${summary}\n\n`;
  content += `## 変更ファイル\n\n${fileList}\n\n\n`;
  content += `## 参考\n- [コミット](${commitUrl})`;

  // Discordの文字数制限(2000文字)を考慮
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

  log.msg('APLG0023', { params: ['Discord通知'] });
}

async function main(): Promise<void> {
  const { commitSha, changedFilesCount } = parseArgs();

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL || '';
  const geminiApiKey = process.env.GEMINI_API_KEY || '';

  if (!webhookUrl) {
    log.error('DISCORD_WEBHOOK_URL 環境変数が未設定です');
    process.exit(1);
  }

  if (!geminiApiKey) {
    log.error('GEMINI_API_KEY 環境変数が未設定です');
    process.exit(1);
  }

  try {
    log.msg('APLG0001', {
      params: ['Discord ドキュメント通知'],
      attrs: { commitSha, changedFilesCount },
    });

    // 1. git diff取得
    const diff = getDocsDiff(commitSha);
    log.info(`git diff 取得完了 (${diff.length} 文字)`);

    // 2. 変更ファイル一覧取得
    const fileList = getChangedFilesList(commitSha);
    log.info('変更ファイル一覧を取得');

    // 3. AI要約生成
    log.msg('APLG0020', { params: ['AI要約'] });
    const client = new GeminiClient(
      geminiApiKey,
      log.child({ component: 'gemini' }),
    );
    const summary = await summarizeDocChanges(
      client,
      diff,
      changedFilesCount,
      commitSha,
    );
    log.msg('APLG0002', { params: ['AI要約'] });

    // 4. Discordメッセージ生成
    const payload = createDiscordMessage(
      commitSha,
      changedFilesCount,
      fileList,
      summary,
    );
    log.info(`Discord メッセージ作成完了 (${payload.content.length} 文字)`);

    // 5. Discord送信
    await sendToDiscord(webhookUrl, payload);
  } catch (error) {
    log.msg('APLG0018', {
      error: error instanceof Error ? error : new Error(String(error)),
    });
    process.exit(1);
  }
}

main().catch((error) => {
  log.msg('APLG0019', {
    error: error instanceof Error ? error : new Error(String(error)),
  });
  process.exit(1);
});
