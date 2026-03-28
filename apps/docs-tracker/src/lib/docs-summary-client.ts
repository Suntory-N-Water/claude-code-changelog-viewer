import type { AppLogger } from '@claude-code-changelog-viewer/common';
import { ApiError, GoogleGenAI } from '@google/genai';
import pRetry, { AbortError } from 'p-retry';
import type { DocFileDiff } from './docs-diff-generator';

const RETRY_DELAY_MS = 60 * 1000;
const MAX_RETRIES_PER_MODEL = 3;
const MAX_DIFF_LINES_FOR_PROMPT = 200;

const MODEL_RATE_LIMITS: Record<string, number> = {
  'gemini-3-flash-preview': 15 * 1000,
  'gemini-3.1-flash-lite-preview': 15 * 1000,
  'gemini-2.5-flash': 15 * 1000,
  'gemini-2.5-flash-lite': 10 * 1000,
};

const FALLBACK_MODELS = [
  'gemini-3-flash-preview',
  'gemini-3.1-flash-lite-preview',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

export class DocsSummaryClient {
  private ai: GoogleGenAI;
  private log: AppLogger;
  private lastRequestTimes: Map<string, number> = new Map();

  constructor(apiKey: string, logger: AppLogger) {
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY 環境変数が未設定です');
    }
    this.ai = new GoogleGenAI({ apiKey });
    this.log = logger.child({ component: 'DocsSummaryClient' });
  }

  private async waitForRateLimit(model: string): Promise<void> {
    const now = Date.now();
    const lastRequestTime = this.lastRequestTimes.get(model) ?? 0;
    const timeSinceLastRequest = now - lastRequestTime;
    const minInterval = MODEL_RATE_LIMITS[model] ?? 12 * 1000;

    if (timeSinceLastRequest < minInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, minInterval - timeSinceLastRequest),
      );
    }
    this.lastRequestTimes.set(model, Date.now());
  }

  private isRetryableError(error: Error): boolean {
    return (
      error instanceof ApiError &&
      (error.status === 429 || error.status === 503)
    );
  }

  /**
   * diff の内容から日本語サマリーを生成
   */
  async generateSummary(files: DocFileDiff[]): Promise<string> {
    const prompt = this.buildPrompt(files);
    let lastError: Error | null = null;

    for (const model of FALLBACK_MODELS) {
      try {
        return await pRetry(
          async () => {
            this.log.info(`モデルを試行: ${model}`, {
              method: 'generateSummary',
            });
            await this.waitForRateLimit(model);

            const response = await this.ai.models.generateContent({
              model,
              contents: prompt,
              config: { thinkingConfig: { thinkingBudget: 0 } },
            });

            if (!response.text) {
              throw new Error('Gemini API からの応答が空です');
            }

            const usage = response.usageMetadata;
            this.log.info(
              `トークン消費: ↑${usage?.promptTokenCount ?? 0} ↓${usage?.candidatesTokenCount ?? 0}`,
              { method: 'generateSummary', model },
            );

            return response.text.trim();
          },
          {
            retries: MAX_RETRIES_PER_MODEL,
            onFailedAttempt: async ({ error, attemptNumber }) => {
              if (!this.isRetryableError(error)) {
                throw new AbortError(error.message);
              }
              this.log.warn(
                `リトライ待機: ${RETRY_DELAY_MS / 1000}秒 (${model}, ${attemptNumber}/${MAX_RETRIES_PER_MODEL + 1})`,
              );
              await new Promise((resolve) =>
                setTimeout(resolve, RETRY_DELAY_MS),
              );
            },
          },
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        this.log.warn(`モデル失敗: ${model} - ${lastError.message}`);
      }
    }

    // 全モデル失敗時はフォールバックメッセージを返す
    this.log.error(`全モデルが失敗しました: ${lastError?.message}`);
    return `Claude Code の日本語ドキュメントが更新されました(${files.length} ファイル)。`;
  }

  private buildPrompt(files: DocFileDiff[]): string {
    const filesSummary = files
      .map((f) => `- ${f.filename}: +${f.additions}行 -${f.deletions}行`)
      .join('\n');

    // diff の追加・削除行を最大 MAX_DIFF_LINES_FOR_PROMPT 行に切り詰め
    const diffLines: string[] = [];
    let lineCount = 0;
    for (const file of files) {
      if (lineCount >= MAX_DIFF_LINES_FOR_PROMPT) {
        break;
      }
      diffLines.push(`\n### ${file.filename}`);
      for (const hunk of file.hunks) {
        if (lineCount >= MAX_DIFF_LINES_FOR_PROMPT) {
          break;
        }
        for (const line of hunk.lines) {
          if (line.type === 'context') {
            continue;
          }
          const prefix = line.type === 'added' ? '+' : '-';
          diffLines.push(`${prefix} ${line.content}`);
          lineCount++;
          if (lineCount >= MAX_DIFF_LINES_FOR_PROMPT) {
            break;
          }
        }
      }
    }

    const diffContent =
      diffLines.length > 0 ? diffLines.join('\n') : '(差分の詳細なし)';

    return `# 思考のレンズ

## 前提 (Premise)
- Claude Code は開発者向けの AI アシスタント CLI ツールである
- 公式の日本語ドキュメントが更新された
- 開発者は変更の概要を素早く把握したい

## 状況 (Situation)
- 変更ファイル数: ${files.length}
- 変更ファイル一覧:
${filesSummary}

- 変更内容(抜粋):
${diffContent}

## 目的 (Purpose)
このドキュメント変更の要約を日本語で作成する。
開発者が「何が具体的に変わったか」を一目で理解できる要約を提供する。

## 動機 (Motive)
抽象的な説明ではなく、具体的な変更内容を伝える。
例: 「ドキュメントが更新されました」ではなく「hooks.md でフック設定の説明に新しい環境変数の説明が追加されました」のように具体的に記述する。
新機能の追加、既存機能の変更、設定オプションの追加などを優先的に言及する。

## 制約 (Constraint)
- 3-5文で簡潔にまとめる
- 具体的なファイル名や変更内容を含める
- 「です・ます」調で統一
- 要約テキストのみを出力し、説明や追加情報は不要

# 出力形式
要約テキストのみを出力してください。`;
  }
}
