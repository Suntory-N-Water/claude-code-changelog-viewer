import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { AppLogger } from '@claude-code-changelog-viewer/common';

const execAsync = promisify(exec);

// 単一ファイルの diff が大きい場合にファイル詳細を省略する閾値(追加+削除行数)
const MAX_FILE_DIFF_LINES = 200;

export type DiffLine = {
  type: 'added' | 'removed' | 'context';
  content: string;
};

export type DiffHunk = {
  header: string;
  lines: DiffLine[];
};

export type DocFileDiff = {
  filename: string;
  additions: number;
  deletions: number;
  explanation: string; // AI生成のファイル単位解説(1〜2文)
  hunks: DiffHunk[];
};

export type DocsDiffEntry = {
  id: string; // "20260328-091500"(タイムスタンプ、URL slug 兼用)
  timestamp: string; // ISO8601
  aiSummary: string;
  files: DocFileDiff[];
};

export class DocsDiffGenerator {
  private readonly rootDir: string;
  private readonly diffsDir: string;
  private readonly log: AppLogger;

  constructor(rootDir: string, logger: AppLogger) {
    this.rootDir = rootDir;
    this.diffsDir = path.join(rootDir, 'diffs');
    this.log = logger.child({ component: 'DocsDiffGenerator' });
  }

  /**
   * git diff --staged から docs/en/ の変更を取得してパース
   */
  async getEnStagedDiff(): Promise<DocFileDiff[]> {
    try {
      const { stdout } = await execAsync(
        "git diff --staged --unified=3 -- 'apps/docs-tracker/docs/en/' ':(exclude)apps/docs-tracker/docs/en/changelog.md'",
        {
          cwd: path.join(this.rootDir, '..', '..'),
          maxBuffer: 20 * 1024 * 1024,
        },
      );

      if (!stdout.trim()) {
        this.log.info('英語ドキュメントにステージング済みの変更なし');
        return [];
      }

      const totalLines = stdout.split('\n').length;
      this.log.info(`diff 取得完了: ${totalLines} 行`);

      return this.parseUnifiedDiff(stdout);
    } catch (error) {
      if (error instanceof Error) {
        this.log.error('git diff の取得に失敗', error);
      }
      return [];
    }
  }

  /**
   * unified diff テキストを DocFileDiff[] にパース
   * 単一ファイルの追加+削除行数が MAX_FILE_DIFF_LINES を超える場合は hunks を省略する
   */
  parseUnifiedDiff(diffText: string): DocFileDiff[] {
    const files: DocFileDiff[] = [];
    const lines = diffText.split('\n');

    let currentFile: DocFileDiff | null = null;
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // 新しいファイルの開始
      if (line.startsWith('diff --git ')) {
        if (currentFile) {
          currentFile = this.finalizeFileDiff(currentFile, currentHunk, files);
          currentHunk = null;
        }

        // ファイル名を抽出("apps/docs-tracker/docs/en/foo.md" → "foo.md")
        const match = line.match(/diff --git a\/.+\/docs\/en\/(.+) b\//);
        const filename =
          match?.[1] ?? line.replace('diff --git ', '').split(' ')[0];
        currentFile = {
          filename: filename ?? '',
          additions: 0,
          deletions: 0,
          explanation: '',
          hunks: [],
        };
        currentHunk = null;
        continue;
      }

      if (!currentFile) {
        continue;
      }

      // ハンクヘッダー
      if (line.startsWith('@@ ')) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk);
        }
        currentHunk = { header: line, lines: [] };
        continue;
      }

      // git diff のメタデータ行をスキップ
      if (
        line.startsWith('index ') ||
        line.startsWith('--- ') ||
        line.startsWith('+++ ') ||
        line.startsWith('new file mode') ||
        line.startsWith('deleted file mode') ||
        line.startsWith('\\ No newline')
      ) {
        continue;
      }

      // diff 行の処理
      if (line.startsWith('+')) {
        currentFile.additions += 1;
        if (currentHunk) {
          currentHunk.lines.push({ type: 'added', content: line.slice(1) });
        }
      } else if (line.startsWith('-')) {
        currentFile.deletions += 1;
        if (currentHunk) {
          currentHunk.lines.push({ type: 'removed', content: line.slice(1) });
        }
      } else if (line.startsWith(' ') && currentHunk) {
        currentHunk.lines.push({ type: 'context', content: line.slice(1) });
      }
    }

    // 最後のファイルを追加
    if (currentFile) {
      this.finalizeFileDiff(currentFile, currentHunk, files);
    }

    return files.filter((f) => f.filename !== '');
  }

  /**
   * 現在のファイル diff を確定して files に追加する
   * 追加+削除行数が MAX_FILE_DIFF_LINES を超える場合は hunks を省略する
   * @returns null(次のファイル処理用)
   */
  private finalizeFileDiff(
    file: DocFileDiff,
    hunk: DiffHunk | null,
    files: DocFileDiff[],
  ): null {
    if (hunk) {
      file.hunks.push(hunk);
    }
    if (file.additions + file.deletions > MAX_FILE_DIFF_LINES) {
      file.hunks = [];
    }
    files.push(file);
    return null;
  }

  /**
   * diff エントリを {id}.json として diffs/ ディレクトリに保存
   */
  async appendDiffEntry(
    files: DocFileDiff[],
    aiSummary: string,
  ): Promise<string> {
    await fs.mkdir(this.diffsDir, { recursive: true });

    const now = new Date();
    const id = this.formatTimestampId(now);
    const entry: DocsDiffEntry = {
      id,
      timestamp: now.toISOString(),
      aiSummary,
      files,
    };

    const filePath = path.join(this.diffsDir, `${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(entry, null, 2), 'utf-8');

    this.log.info(
      `diff エントリを保存しました: ${id}.json (${files.length} ファイル)`,
    );
    return id;
  }

  /**
   * "YYYYMMDD-HHMMSS" 形式の ID を生成
   */
  private formatTimestampId(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return [
      date.getUTCFullYear(),
      pad(date.getUTCMonth() + 1),
      pad(date.getUTCDate()),
      '-',
      pad(date.getUTCHours()),
      pad(date.getUTCMinutes()),
      pad(date.getUTCSeconds()),
    ].join('');
  }
}
