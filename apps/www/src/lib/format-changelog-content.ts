import { escapeHtml } from './escape-html';

/**
 * Changelog本文のMarkdown記法を整形してHTMLに変換
 * - バッククォート内のテキストを<code>タグでラップ
 * - 先頭の `-` プレフィックスを削除
 */
export function formatChangelogContent(content: string): string {
  return escapeHtml(content.replace(/^-\s+/, '')).replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-[hsl(var(--cc-gray))] text-[hsl(var(--cc-main-black))] text-sm font-mono break-all">$1</code>',
  );
}
