import remarkGfm from 'remark-gfm';
import remarkMdx from 'remark-mdx';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { postProcess } from './markdown-cleaner/post-process';
import { preProcess } from './markdown-cleaner/pre-process';
import { remarkStripMdxComponents } from './markdown-cleaner/remark-strip-mdx-components';

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
    // AST処理失敗時は前処理+後処理のみ適用
    return postProcess(preProcessed);
  }
}
