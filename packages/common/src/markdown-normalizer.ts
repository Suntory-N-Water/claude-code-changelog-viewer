import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import { unified } from 'unified';

type MarkdownNode = {
  type: string;
  value?: string;
  children?: MarkdownNode[];
};

const markdownProcessor = unified().use(remarkParse).use(remarkGfm);

const TEXT_BLOCK_TYPES = new Set([
  'heading',
  'paragraph',
  'listItem',
  'blockquote',
  'tableCell',
]);

const SKIP_TYPES = new Set([
  'code',
  'html',
  'image',
  'imageReference',
  'definition',
  'footnoteDefinition',
]);

function preprocess(text: string): string {
  return text
    .replace(/\r\n?/gu, '\n')
    .replace(/^---\s*[\s\S]*?\s*---\s*/u, ' ')
    .replace(/```[\s\S]*?```/gu, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/giu, ' ')
    .replace(/\bcss\s*`[\s\S]*?`/gu, ' ')
    .replace(/\bstyled\.[a-z][\w-]*\s*`[\s\S]*?`/giu, ' ');
}

function removeMarkupNoise(text: string): string {
  return text
    .replace(/<[^>]+>/gu, ' ')
    .replace(
      /\{[^{}]*(?:display|align-items|justify-content|font-size|font-weight|color|background|border|border-radius|padding|margin|gap|width|height|flex|transition|white-space)[^{}]*\}/giu,
      ' ',
    )
    .replace(/[.#][-_a-zA-Z][-_a-zA-Z0-9:.#\s-]*\{[^{}]*\}/gu, ' ')
    .replace(/--[-_a-zA-Z0-9]+\s*:\s*[^;]+;?/gu, ' ')
    .replace(/@media\s*\([^)]*\)/gu, ' ')
    .replace(/(?:^|\s)[.#][-_a-zA-Z][-_a-zA-Z0-9:.-]*(?=\s|$)/gu, ' ')
    .replace(
      /\b(?:className|class|style|theme|expandable)=\{?["'][^"']*["']\}?/gu,
      ' ',
    )
    .replace(/\b(?:const|let|var)\s+[A-Z][_A-Z0-9]*\s*=/gu, ' ')
    .replace(/\breturn\s*;?/gu, ' ')
    .replace(/`;/gu, ' ');
}

function normalizeText(text: string): string {
  const withoutNoise = removeMarkupNoise(text);
  return withoutNoise
    .replace(/\\"/gu, '"')
    .replace(/¥"/gu, '"')
    .replace(/\s+/gu, ' ')
    .trim();
}

function isNoise(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed === '' ||
    /^import\s.+\sfrom\s/u.test(trimmed) ||
    /^\/\//u.test(trimmed) ||
    /^--[-_a-zA-Z0-9]+\s*:/u.test(trimmed) ||
    /(?:className|class|style|theme|expandable)=/u.test(trimmed) ||
    /^[.#]?[-_a-zA-Z][-_a-zA-Z0-9]*\s*\{/u.test(trimmed) ||
    /^(?:[.#][-_a-zA-Z][-_a-zA-Z0-9:.-]*\s*)+$/u.test(trimmed) ||
    /^(?:[-a-z]+\s*:\s*[^;]+;\s*)+$/u.test(trimmed) ||
    /^\}?[\s.#[\]:_a-zA-Z0-9-]*\{[^}]*\}?$/u.test(trimmed) ||
    /^\}$/u.test(trimmed)
  );
}

function inlineText(node: MarkdownNode): string {
  if (SKIP_TYPES.has(node.type)) {
    return '';
  }

  if (node.type === 'text' || node.type === 'inlineCode') {
    return node.value ?? '';
  }

  if (!node.children) {
    return '';
  }

  const parts = node.children.map((child) => inlineText(child));
  return parts.join(' ');
}

function collectBlocks(node: MarkdownNode, blocks: string[]): void {
  if (SKIP_TYPES.has(node.type)) {
    return;
  }

  if (TEXT_BLOCK_TYPES.has(node.type)) {
    const text = normalizeText(inlineText(node));
    if (text && !isNoise(text)) {
      blocks.push(text);
    }
    return;
  }

  if (!node.children) {
    return;
  }

  for (const child of node.children) {
    collectBlocks(child, blocks);
  }
}

function uniqueTexts(texts: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const text of texts) {
    if (seen.has(text)) {
      continue;
    }

    seen.add(text);
    unique.push(text);
  }

  return unique;
}

function fallbackNormalize(text: string): string {
  const preprocessed = preprocess(text);
  const lines = preprocessed.split('\n');
  const normalizedLines = lines
    .map((line) => line.replace(/!\[[^\]]*\]\([^)]*\)/gu, ' '))
    .map((line) => line.replace(/\[([^\]]+)\]\([^)]*\)/gu, '$1'))
    .map((line) => line.replace(/`([^`]+)`/gu, '$1'))
    .map((line) => line.replace(/<[^>]+>/gu, ' '))
    .map(normalizeText)
    .filter((line) => !isNoise(line));

  const unique = uniqueTexts(normalizedLines);
  const joined = unique.join(' ');
  return normalizeText(joined);
}

export function normalizeMarkdownForAi(text: string): string {
  try {
    const preprocessed = preprocess(text);
    const tree = markdownProcessor.parse(preprocessed) as Root;
    const blocks: string[] = [];

    collectBlocks(tree, blocks);

    const unique = uniqueTexts(blocks);
    const joined = unique.join(' ');
    return normalizeText(joined);
  } catch {
    return fallbackNormalize(text);
  }
}
