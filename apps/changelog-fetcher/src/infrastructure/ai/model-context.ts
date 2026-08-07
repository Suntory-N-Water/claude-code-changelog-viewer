import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROJECT_ROOT } from '../docs/docs-paths';

const MODELS_OVERVIEW_PATH = join(
  PROJECT_ROOT,
  'apps',
  'docs-tracker',
  'docs',
  'en',
  'about-claude',
  'models',
  'overview.md',
);

/**
 * models/overview.md の "Latest models comparison" テーブルヘッダー行から
 * モデル名を抽出する。
 *
 * ヘッダー行の例:
 *   | Feature | <NextOpus /> | Claude Sonnet 4.6 | Claude Haiku 4.5 |
 *
 * <NextOpus /> は移行アンカー {#migrating-to-claude-opus-X-X} から解決する。
 */
export function parseModelNames(content: string): string[] {
  const names: string[] = [];

  const headerMatch = content.match(
    /###\s+Latest models comparison[\s\S]*?(\|[^\n]+\|)/,
  );
  if (headerMatch?.[1]) {
    const cells = headerMatch[1]
      .split('|')
      .map((s) => s.trim())
      .filter(Boolean);

    for (const cell of cells) {
      // "Claude Sonnet 4.6" / "Claude Haiku 4.5" 形式
      const named = cell.match(/^Claude\s+(\w+\s+[\d.]+)/);
      if (named?.[1]) {
        names.push(named[1]);
      }
    }
  }

  // <NextOpus /> を移行セクションのアンカーから解決
  // 例: {#migrating-to-claude-opus-4-8} → "Opus 4.8"
  const opusAnchor = content.match(/\{#migrating-to-claude-(opus-[\d-]+)\}/);
  if (opusAnchor?.[1]) {
    const parts = opusAnchor[1].split('-');
    if (parts.length >= 3) {
      names.unshift(`Opus ${parts[1]}.${parts[2]}`);
    }
  }

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
 * models/overview.md から現在の Claude モデル情報を読み取り、
 * プロンプトに埋め込むテキストブロックを返す
 */
export function loadModelContext(): string {
  const raw = readFileSync(MODELS_OVERVIEW_PATH, 'utf-8');
  const models = parseModelNames(raw);
  return buildModelContext(models);
}
