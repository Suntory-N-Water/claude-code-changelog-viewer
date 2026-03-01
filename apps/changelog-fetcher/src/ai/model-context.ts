import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../searchers/paths';

const MODEL_CONFIG_PATH = join(
  PROJECT_ROOT,
  'apps',
  'docs-tracker',
  'docs',
  'en',
  'model-config.md',
);

/**
 * model-config.md のエイリアステーブルからモデル名を抽出
 *
 * テーブル行の例:
 *   | **`sonnet`** | Uses the latest Sonnet model (currently Sonnet 4.6) for daily coding tasks |
 *   → "Sonnet 4.6"
 */
export function parseModelNames(content: string): string[] {
  const currentlyPattern = /\(currently\s+([^)]+)\)/g;
  const matches = content.matchAll(currentlyPattern);
  const names = Array.from(matches, (m) => m[1])
    .filter((s): s is string => s != null)
    .map((s) => s.trim());
  return [...new Set(names)];
}

/**
 * パース済みモデル名リストからプロンプト用テキストブロックを構築
 *
 * コアの制約(ハルシネーション防止)はモデル名取得の成否に依存しない。
 * モデル名が取れた場合のみ、参考情報として補足する。
 */
export function buildModelContext(models: string[]): string {
  const lines = [
    '- CHANGELOG の原文や snippets に記載されていないモデル名・バージョン番号・スペック値を捏造しないこと',
    '- CHANGELOG の原文に具体的なモデル名が記載されている場合はそのまま使用すること',
  ];

  if (models.length > 0) {
    const modelList = models.map((m) => `**${m}**`).join(' / ');
    lines.push(`- 参考: 現在の Claude Code 主要モデルは ${modelList}`);
  }

  return lines.join('\n');
}

/**
 * model-config.md から現在の Claude Code モデル情報を読み取り、
 * プロンプトに埋め込むテキストブロックを返す
 */
export function loadModelContext(): string {
  const raw = readFileSync(MODEL_CONFIG_PATH, 'utf-8');
  const models = parseModelNames(raw);
  return buildModelContext(models);
}
