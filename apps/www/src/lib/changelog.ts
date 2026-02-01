/**
 * Changelog本文のMarkdown記法を整形してHTMLに変換
 * - バッククォート内のテキストを<code>タグでラップ
 * - 先頭の `-` プレフィックスを削除
 */
export function formatChangelogContent(content: string): string {
  // 先頭の "- " を削除
  let formatted = content.replace(/^-\s+/, '');

  // バッククォートを<code>タグに変換
  formatted = formatted.replace(
    /`([^`]+)`/g,
    '<code class="px-1.5 py-0.5 rounded bg-[hsl(var(--cc-gray))] text-[hsl(var(--cc-main-black))] text-sm font-mono break-all">$1</code>',
  );

  return formatted;
}
