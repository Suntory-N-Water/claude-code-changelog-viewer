import { escapeHtml } from './escape-html';

const CODE_TAG =
  '<code class="px-1.5 py-0.5 rounded bg-[hsl(var(--cc-gray))] text-[hsl(var(--cc-main-black))] text-sm font-mono break-all">$1</code>';

/**
 * Changelog本文のMarkdown記法を整形してHTMLに変換
 * - バッククォート内のテキストを<code>タグでラップ
 * - 先頭の `-` プレフィックスを削除
 */
export function formatChangelogContent(content: string): string {
  return escapeHtml(content.replace(/^-\s+/, '')).replace(
    /`([^`]+)`/g,
    CODE_TAG,
  );
}

const CLAUDE_CODE_DOCS_BASE = 'https://code.claude.com/docs';

/**
 * 設定の description 向け整形(Markdownリンクを HTML リンクに変換)
 * - [text](/en/path) → <a href="https://code.claude.com/docs/en/path">text</a>
 * - [text](https://...) → <a href="https://..." target="_blank">text</a>
 * - バッククォート → <code>
 */
export function formatSettingDescription(content: string): string {
  return escapeHtml(content)
    .replace(
      /\[([^\]]+)\]\((\/en\/[^)]+)\)/g,
      `<a href="${CLAUDE_CODE_DOCS_BASE}$2" class="text-[hsl(var(--cc-main-orange))] hover:underline">$1</a>`,
    )
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[hsl(var(--cc-main-orange))] hover:underline">$1</a>',
    )
    .replace(/`([^`]+)`/g, CODE_TAG);
}

/**
 * use_case_ja 向け整形(箇条書きと改行をHTMLにレンダリング)
 * - `- ` 始まりの行を <ul><li> に変換
 * - バッククォート → <code>
 */
export function formatUseCaseJa(content: string): string {
  const escaped = escapeHtml(content).replace(/`([^`]+)`/g, CODE_TAG);
  const lines = escaped.split('\n');
  const htmlLines = lines.map((line) => {
    const trimmed = line.trimStart();
    if (trimmed.startsWith('- ')) {
      return `<li class="ml-4 list-disc">${trimmed.slice(2)}</li>`;
    }
    return line ? `<p>${line}</p>` : '';
  });
  const result = htmlLines.join('');
  if (result.includes('<li')) {
    return result.replace(
      /(<li[^>]*>.*?<\/li>)+/gs,
      '<ul class="space-y-1 list-outside">$&</ul>',
    );
  }
  return result;
}
