import type { Root } from 'mdast';
import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const REMOVE_TAGS = new Set(['img', 'style']);

export async function cleanMarkdown(raw: string): Promise<string> {
  const preProcessed = preProcess(raw);
  try {
    const file = await unified()
      .use(remarkParse)
      .use(remarkGfm, { tablePipeAlign: false })
      .use(remarkMdx)
      .use(remarkStripMdxComponents)
      .use(remarkStringify)
      .data('settings', {
        bullet: '-' as const,
        emphasis: '*' as const,
        fences: true,
      })
      .process(preProcessed);
    return postProcess(String(file));
  } catch {
    return postProcess(preProcessed);
  }
}

function preProcess(raw: string): string {
  let result = removeDocumentationIndex(raw);
  result = removeCodeFenceTheme(result);
  result = removeExportedComponents(result);
  return result;
}

function removeCodeFenceTheme(input: string): string {
  return input.replace(/^(```\w*(?:\s+\w+)?)\s+theme=\{null\}/gm, '$1');
}

function removeDocumentationIndex(input: string): string {
  return input.replace(
    /^> ## Documentation Index\n> Fetch the complete documentation index at:.*\n> Use this file to discover all available pages before exploring further\.\n*/gm,
    '',
  );
}

function removeExportedComponents(input: string): string {
  const lines = input.split('\n');
  const result: string[] = [];
  let inCodeFence = false;
  let inExportBlock = false;

  for (const line of lines) {
    if (/^```/.test(line)) {
      inCodeFence = !inCodeFence;
    }

    if (inCodeFence) {
      result.push(line);
      continue;
    }

    if (!inExportBlock && /^export\s+const\s+/.test(line)) {
      inExportBlock = true;
      continue;
    }

    if (inExportBlock) {
      if (/^};?\s*$/.test(line)) {
        inExportBlock = false;
      }
      continue;
    }

    result.push(line);
  }

  return result.join('\n');
}

function remarkStripMdxComponents() {
  return (tree: Root) => {
    visit(tree, (node, index, parent) => {
      if (!parent || index === undefined) {
        return;
      }

      if (node.type === 'mdxjsEsm') {
        parent.children.splice(index, 1);
        return index;
      }

      if (
        node.type === 'mdxFlowExpression' ||
        node.type === 'mdxTextExpression'
      ) {
        parent.children.splice(index, 1);
        return index;
      }

      if (
        node.type === 'mdxJsxFlowElement' ||
        node.type === 'mdxJsxTextElement'
      ) {
        const tagName = (node as { name?: string | null }).name;

        if (tagName && REMOVE_TAGS.has(tagName)) {
          parent.children.splice(index, 1);
          return index;
        }

        if (!node.children || node.children.length === 0) {
          parent.children.splice(index, 1);
          return index;
        }

        parent.children.splice(
          index,
          1,
          ...(node.children as (typeof parent.children)[number][]),
        );
        return index;
      }

      return;
    });
  };
}

function postProcess(input: string): string {
  return input.replace(/\n{3,}/g, '\n\n');
}
