import { execSync } from 'node:child_process';
import {
  DISCORD_BOT_AVATAR_URL,
  DISCORD_SUPPRESS_EMBEDS,
  type DiscordWebhookPayload,
  getLogger,
  sendToDiscord,
  toError,
  truncateForDiscord,
} from '@claude-code-changelog-viewer/common';
import { getOfficialDocUrl } from '@claude-code-changelog-viewer/types';
import { GeminiClient } from '../ai/gemini-client';

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
 * git diffを取得(docs/配下のみ)
 */
function getDocsDiff(commitSha: string, repoRoot: string): string {
  try {
    const pathspec = docsPathspec(repoRoot);
    const diffCommand = `git diff ${commitSha}~1 ${commitSha} ${pathspec}`;
    log.debug(`diff コマンド実行: ${diffCommand}`);

    const diff = execSync(diffCommand, {
      encoding: 'utf-8',
      maxBuffer: 10 * 1024 * 1024,
      cwd: repoRoot,
    });

    log.info(`diff 取得完了: ${diff.length} 文字`);

    if (diff.length < 100) {
      log.warn(
        'diff が非常に小さいため、メタデータのみの変更の可能性があります',
      );
      return 'Minimal diff detected - changes may be metadata only';
    }

    // トークン溢れ防止(最大3000行)
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
 * Geminiでドキュメントのdiffを要約
 */
async function summarizeDocChanges(
  client: GeminiClient,
  diff: string,
  changedFilesCount: number,
  commitSha: string,
  repoRoot: string,
): Promise<string> {
  // diffが極端に小さい場合は、変更ファイルの主要な変更箇所を抽出
  let enrichedContext = diff;

  if (diff.length < 100) {
    log.warn('diff が小さいため、ファイルコンテキストを抽出します');

    try {
      const pathspec = docsPathspec(repoRoot);
      const detailedDiff = execSync(
        `git diff ${commitSha}~1 ${commitSha} ${pathspec} | grep -A 3 -B 3 '^[+-]' | grep -v '^index\\|^diff\\|^---\\|^+++'`,
        {
          encoding: 'utf-8',
          maxBuffer: 5 * 1024 * 1024,
          cwd: repoRoot,
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

    const repoRoot = getRepoRoot();
    const isInitialCommit = !hasParentCommit(commitSha);

    if (isInitialCommit) {
      // 初回コミットは簡易メッセージで通知
      const payload = createDiscordMessage(
        commitSha,
        changedFilesCount,
        'Initial commit',
        'Initial commit - all files are new',
      );
      const result = await sendToDiscord(webhookUrl, payload);
      if (!result.ok) {
        throw new Error(`Discord Webhook failed: ${result.status}`);
      }
      log.msg('APLG0023', { params: ['Discord通知'] });
      return;
    }

    // 1. git diff取得
    const diff = getDocsDiff(commitSha, repoRoot);
    log.info(`git diff 取得完了 (${diff.length} 文字)`);

    // 2. 変更ファイル一覧取得
    const fileList = getChangedFilesList(commitSha, repoRoot);
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
      repoRoot,
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
