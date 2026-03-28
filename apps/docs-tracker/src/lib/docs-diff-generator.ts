import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { AppLogger } from '@claude-code-changelog-viewer/common';

const execAsync = promisify(exec);

// diff が巨大な場合(初回取得時など)にファイル詳細を省略する閾値
const MAX_DIFF_LINES = 1000;

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
  hunks: DiffHunk[];
};

export type DocsDiffEntry = {
  id: string; // "20260328-091500"(タイムスタンプ、URL slug 兼用)
  timestamp: string; // ISO8601
  aiSummary: string;
  files: DocFileDiff[];
};

type DocsDiffFile = {
  entries: DocsDiffEntry[];
};

export class DocsDiffGenerator {
  private readonly rootDir: string;
  private readonly diffsDir: string;
  private readonly diffFilePath: string;
  private readonly log: AppLogger;

  constructor(rootDir: string, logger: AppLogger) {
    this.rootDir = rootDir;
    this.diffsDir = path.join(rootDir, 'diffs');
    this.diffFilePath = path.join(this.diffsDir, 'docs_diff.json');
    this.log = logger.child({ component: 'DocsDiffGenerator' });
  }

  /**
   * git diff --staged から docs/ja/ の変更を取得してパース
   */
  async getJaStagedDiff(): Promise<DocFileDiff[]> {
    try {
      const { stdout } = await execAsync(
        "git diff --staged --unified=3 -- 'apps/docs-tracker/docs/ja/**/*.md'",
        {
          cwd: path.join(this.rootDir, '..', '..'),
          maxBuffer: 20 * 1024 * 1024,
        },
      );

      if (!stdout.trim()) {
        this.log.info('日本語ドキュメントにステージング済みの変更なし');
        return [];
      }

      const totalLines = stdout.split('\n').length;
      this.log.info(`diff 取得完了: ${totalLines} 行`);

      return this.parseUnifiedDiff(stdout, totalLines > MAX_DIFF_LINES);
    } catch (error) {
      if (error instanceof Error) {
        this.log.error('git diff の取得に失敗', error);
      }
      return [];
    }
  }

  /**
   * unified diff テキストを DocFileDiff[] にパース
   * @param diffText - git diff の出力
   * @param truncate - true の場合 hunks を空にしてファイル統計のみ記録(初回取得時など)
   */
  parseUnifiedDiff(diffText: string, truncate = false): DocFileDiff[] {
    const files: DocFileDiff[] = [];
    const lines = diffText.split('\n');

    let currentFile: DocFileDiff | null = null;
    let currentHunk: DiffHunk | null = null;

    for (const line of lines) {
      // 新しいファイルの開始
      if (line.startsWith('diff --git ')) {
        if (currentFile) {
          if (currentHunk) {
            currentFile.hunks.push(currentHunk);
            currentHunk = null;
          }
          files.push(currentFile);
        }

        // ファイル名を抽出("apps/docs-tracker/docs/ja/foo.md" → "foo.md")
        const match = line.match(/diff --git a\/.+\/docs\/ja\/(.+) b\//);
        const filename =
          match?.[1] ?? line.replace('diff --git ', '').split(' ')[0];
        currentFile = {
          filename: filename ?? '',
          additions: 0,
          deletions: 0,
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
        currentHunk = truncate ? null : { header: line, lines: [] };
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
        currentFile.additions++;
        if (currentHunk) {
          currentHunk.lines.push({ type: 'added', content: line.slice(1) });
        }
      } else if (line.startsWith('-')) {
        currentFile.deletions++;
        if (currentHunk) {
          currentHunk.lines.push({ type: 'removed', content: line.slice(1) });
        }
      } else if (line.startsWith(' ') && currentHunk) {
        currentHunk.lines.push({ type: 'context', content: line.slice(1) });
      }
    }

    // 最後のファイルを追加
    if (currentFile) {
      if (currentHunk) {
        currentFile.hunks.push(currentHunk);
      }
      files.push(currentFile);
    }

    return files.filter((f) => f.filename !== '');
  }

  /**
   * diff エントリを docs_diff.json に追記(先頭に追加)
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

    // 既存ファイルを読み込み
    let existing: DocsDiffFile = { entries: [] };
    try {
      const content = await fs.readFile(this.diffFilePath, 'utf-8');
      existing = JSON.parse(content) as DocsDiffFile;
    } catch {
      // ファイルが存在しない場合は空から開始
    }

    existing.entries.unshift(entry);

    await fs.writeFile(
      this.diffFilePath,
      JSON.stringify(existing, null, 2),
      'utf-8',
    );

    this.log.info(
      `diff エントリを追記しました: ${id} (${files.length} ファイル)`,
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
