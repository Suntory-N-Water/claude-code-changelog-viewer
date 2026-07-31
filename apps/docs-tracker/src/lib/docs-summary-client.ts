import {
  GeminiClient,
  GeminiModelsExhaustedError,
  getLogger,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';
import { Type } from '@google/genai';
import { z } from 'zod';
import type { DocFileDiff } from './docs-diff-generator';

const MAX_DIFF_LINES_FOR_PROMPT = 200;

const SummaryResponseSchema = z.object({
  aiSummary: z.string(),
  fileExplanations: z.array(
    z.object({
      filename: z.string(),
      explanation: z.string(),
    }),
  ),
});

export type SummaryResult = {
  aiSummary: string;
  fileExplanations: { filename: string; explanation: string }[];
};

export class DocsSummaryClient {
  private readonly client: GeminiClient;
  private readonly log: AppLogger;

  constructor(apiKey: string) {
    this.log = getLogger({ name: 'docs-diff-generator' }).child({
      component: 'DocsSummaryClient',
    });
    this.client = new GeminiClient(apiKey, this.log);
  }

  /**
   * diff の内容から日本語サマリーと各ファイルの解説を生成
   * responseSchema で構造化出力を強制し、Zod でバリデーション
   */
  async generateSummaryAndExplanations(
    files: DocFileDiff[],
  ): Promise<SummaryResult> {
    const prompt = this.buildPrompt(files);
    try {
      return await this.client.generate({
        prompt,
        method: 'generateSummaryAndExplanations',
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              aiSummary: {
                type: Type.STRING,
                description: '3〜5文の日本語概要サマリー',
              },
              fileExplanations: {
                type: Type.ARRAY,
                description: '各ファイルの変更内容の解説',
                items: {
                  type: Type.OBJECT,
                  properties: {
                    filename: {
                      type: Type.STRING,
                      description: 'ファイル名',
                    },
                    explanation: {
                      type: Type.STRING,
                      description: 'このファイルの変更内容を1〜2文で日本語解説',
                    },
                  },
                  propertyOrdering: ['filename', 'explanation'],
                  required: ['filename', 'explanation'],
                },
              },
            },
            propertyOrdering: ['aiSummary', 'fileExplanations'],
            required: ['aiSummary', 'fileExplanations'],
          },
          thinkingConfig: { thinkingBudget: 0 },
        },
        parse: (text) => SummaryResponseSchema.parse(JSON.parse(text)),
      });
    } catch (error) {
      const cause =
        error instanceof GeminiModelsExhaustedError
          ? error.lastError
          : error instanceof Error
            ? error
            : new Error(String(error));
      this.log.error(`全モデルが失敗しました: ${cause.message}`);
      return {
        aiSummary: `Claude Code の英語ドキュメントが更新されました(${files.length} ファイル)。`,
        fileExplanations: [],
      };
    }
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
          lineCount += 1;
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
- 公式の英語ドキュメントが更新された
- 開発者は変更の概要を素早く把握したい

## 状況 (Situation)
- 変更ファイル数: ${files.length}
- 変更ファイル一覧:
${filesSummary}

- 変更内容(抜粋、英語テキスト):
${diffContent}

## 目的 (Purpose)
このドキュメント変更の要約と、各ファイルの解説を日本語で作成する。

## 動機 (Motive)
抽象的な説明ではなく、具体的な変更内容を伝える。
例: 「ドキュメントが更新されました」ではなく「フック設定の説明に新しい環境変数の説明が追加されました」のように具体的に記述する。
新機能の追加、既存機能の変更、設定オプションの追加などを優先的に言及する。

## 制約 (Constraint)
- diff は英語テキストだが、出力は必ず日本語で記述する
- aiSummary: 3〜5文の簡潔な概要。「です・ます」調
- fileExplanations: 変更があったファイルごとに1〜2文で変更内容を解説。「です・ます」調
- ファイル名はパスやURL形式で記述し、拡張子(.md)は付けない。例: hooks、settings/advanced
- ヘッダー記号(#, ##)などのMarkdown記法は使用しない。プレーンテキストのみ
- **禁止**: 「Claude Codeの最新アップデートにより」「今回の更新では」「ドキュメントが更新されました」「このドキュメントでは」などの前置きを一切使わない
- 必ず変更内容・機能・改善点そのものから書き始める(例: 「〇〇設定の説明に新しい環境変数が追加され…」「〇〇機能の使い方が詳しく説明され…」)`;
  }
}
