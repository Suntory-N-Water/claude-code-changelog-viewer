import { execSync } from 'node:child_process';
import {
  DISCORD_BOT_AVATAR_URL,
  DISCORD_SUPPRESS_EMBEDS,
  type DiscordWebhookPayload,
  getLogger,
  getOfficialDocUrl,
  sendToDiscord,
  toError,
  truncateForDiscord,
} from '@claude-code-changelog-viewer/common';

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
      ? Number.parseInt(args[changedFilesIndex + 1] ?? '', 10)
      : 0;

  if (!commitSha) {
    log.error(
      'Usage: bun src/discord/create-docs-summary-message.ts <commit-sha> --changed-files <count>',
    );
    process.exit(1);
  }

  return { commitSha, changedFilesCount };
}

/**
 * リポジトリルートを取得
 */
function getRepoRoot(): string {
  return execSync('git rev-parse --show-toplevel', {
    encoding: 'utf-8',
  }).trim();
}

/**
 * 親コミットの存在確認
 * @returns 親が存在すれば true
 */
function hasParentCommit(commitSha: string): boolean {
  try {
    const parentSha = execSync(`git rev-parse ${commitSha}~1`, {
      encoding: 'utf-8',
    }).trim();
    log.info(`親コミットを確認: ${parentSha}`);
    return true;
  } catch {
    log.info('親コミットなし - 初回コミット');
    return false;
  }
}

/**
 * docs 配下の diff 用 git pathspec を構築
 */
function docsPathspec(repoRoot: string): string {
  return `-- '${repoRoot}/apps/docs-tracker/docs/**/*.md' ':(exclude)${repoRoot}/apps/docs-tracker/docs/**/changelog.md'`;
}

/**
 * git diffから変更ファイル一覧を取得(公式ドキュメントリンク付き)
 */
function getChangedFilesList(commitSha: string, repoRoot: string): string {
  try {
    const pathspec = docsPathspec(repoRoot);
    const files = execSync(
      `git diff ${commitSha}~1 ${commitSha} --name-only ${pathspec}`,
      {
        encoding: 'utf-8',
        cwd: repoRoot,
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
      const officialUrl = getOfficialDocUrl(f);
      return officialUrl
        ? `• [${displayPath}](${officialUrl})`
        : `• ${displayPath}`;
    });

    if (fileArray.length > 15) {
      const remaining = fileArray.length - 15;
      fileList.push(`... and ${remaining} more files`);
    }

    return fileList.join('\n');
  } catch (error) {
    if (error instanceof Error) {
      log.error('変更ファイル一覧の取得に失敗', error);
    }
    return 'Failed to retrieve file list';
  }
}

/**
 * Discord Webhook用のメッセージを生成
 */
function createDiscordMessage(
  commitSha: string,
  changedFilesCount: number,
  fileList: string,
): DiscordWebhookPayload {
  const commitUrl = `https://github.com/Suntory-N-Water/claude-code-changelog-viewer/commit/${commitSha}`;

  let content = '# 📝 Claude Code ドキュメント更新\n\n';
  content += `## 変更概要\n${changedFilesCount}件のドキュメントが更新されました\n\n`;
  content += `## 変更ファイル\n\n${fileList}\n\n\n`;
  content += `## 参考\n- [コミット](${commitUrl})`;

  const suffix = `...\n\n## 参考\n- [コミット](${commitUrl})`;
  content = truncateForDiscord(content, suffix);

  return {
    content,
    username: 'Claude Code Docs Bot',
    avatar_url: DISCORD_BOT_AVATAR_URL,
    flags: DISCORD_SUPPRESS_EMBEDS,
  };
}

async function main(): Promise<void> {
  const { commitSha, changedFilesCount } = parseArgs();

  const webhookUrl = process.env['DISCORD_WEBHOOK_URL'] || '';

  if (!webhookUrl) {
    log.error('DISCORD_WEBHOOK_URL 環境変数が未設定です');
    process.exit(1);
  }

  try {
    log.msg('APLG0001', {
      params: ['Discord ドキュメント通知'],
      attrs: { commitSha, changedFilesCount },
    });

    const repoRoot = getRepoRoot();
    const isInitialCommit = !hasParentCommit(commitSha);

    if (isInitialCommit) {
      // 初回コミットは簡易メッセージで通知
      const payload = createDiscordMessage(
        commitSha,
        changedFilesCount,
        'Initial commit',
      );
      const result = await sendToDiscord(webhookUrl, payload);
      if (!result.ok) {
        throw new Error(`Discord Webhook failed: ${result.status}`);
      }
      log.msg('APLG0023', { params: ['Discord通知'] });
      return;
    }

    // 1. 変更ファイル一覧取得
    const fileList = getChangedFilesList(commitSha, repoRoot);
    log.info('変更ファイル一覧を取得');

    // 2. Discordメッセージ生成
    const payload = createDiscordMessage(
      commitSha,
      changedFilesCount,
      fileList,
    );
    log.info(`Discord メッセージ作成完了 (${payload.content.length} 文字)`);

    // 3. Discord送信
    const result = await sendToDiscord(webhookUrl, payload);
    if (!result.ok) {
      throw new Error(`Discord Webhook failed: ${result.status}`);
    }
    log.msg('APLG0023', { params: ['Discord通知'] });
  } catch (error) {
    log.msg('APLG0018', { error: toError(error) });
    process.exit(1);
  }
}

main().catch((error) => {
  log.msg('APLG0019', { error: toError(error) });
  process.exit(1);
});
