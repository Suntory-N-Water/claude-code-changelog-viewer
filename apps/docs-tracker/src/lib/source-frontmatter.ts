import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import * as YAML from 'yaml';

const logger = getLogger({ name: 'docs-tracker' }).child({
  component: 'sourceFrontmatter',
});

export const blogSourceValues = [
  'claude-blog',
  'anthropic-news',
  'anthropic-engineering',
] as const;

const sourceValues = [...blogSourceValues, 'youtube'] as const;

const baseSourceFrontmatterSchema = z.object({
  source: z.enum(sourceValues),
  url: z.url(),
  title: z.string().min(1),
  published_at: z.iso.datetime(),
  content_hash: z.string().min(1),
  lang: z.literal('en'),
});

export const blogFrontmatterSchema = baseSourceFrontmatterSchema.extend({
  source: z.enum(blogSourceValues),
});

export const youtubeFrontmatterSchema = baseSourceFrontmatterSchema.extend({
  source: z.literal('youtube'),
  video_id: z.string().min(1),
  channel_id: z.string().min(1),
  duration_sec: z.number().int().nonnegative(),
  has_transcript: z.boolean(),
});

export const sourceFrontmatterSchema = z.discriminatedUnion('source', [
  blogFrontmatterSchema,
  youtubeFrontmatterSchema,
]);

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>;
export type SourceFrontmatter = z.infer<typeof sourceFrontmatterSchema>;

const FRONTMATTER_PATTERN = /^---\n([\s\S]*?)\n---\n?/;

export async function loadSourceFrontmatters(
  sourceDir: string,
): Promise<SourceFrontmatter[]> {
  try {
    const entries = await fs.readdir(sourceDir, { withFileTypes: true });
    const records: SourceFrontmatter[] = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.md')) {
        continue;
      }

      const filePath = path.join(sourceDir, entry.name);
      const content = await fs.readFile(filePath, 'utf-8');
      const frontmatter = parseSourceFrontmatter(content);

      if (!frontmatter.success) {
        logger.warn('source frontmatter の読み込みをスキップしました', {
          'file.path': filePath,
          'exception.message': frontmatter.error,
        });
        continue;
      }

      records.push(frontmatter.data);
    }

    return records;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

export function parseSourceFrontmatter(
  markdown: string,
):
  | { success: true; data: SourceFrontmatter }
  | { success: false; error: string } {
  const match = markdown.match(FRONTMATTER_PATTERN);
  if (!match?.[1]) {
    return { success: false, error: 'frontmatter がありません' };
  }

  let parsedYaml: unknown;
  try {
    parsedYaml = YAML.parse(match[1]);
  } catch (error) {
    return {
      success: false,
      error: `frontmatter の YAML パースに失敗しました: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const parsed = sourceFrontmatterSchema.safeParse(parsedYaml);
  if (!parsed.success) {
    return {
      success: false,
      error: z.prettifyError(parsed.error),
    };
  }

  return { success: true, data: parsed.data };
}

export function serializeSourceDocument(
  frontmatter: SourceFrontmatter,
  body: string,
): string {
  const parsed = sourceFrontmatterSchema.parse(frontmatter);
  const normalizedBody = body.trim();
  const serializedFrontmatter = YAML.stringify(parsed).trimEnd();

  if (normalizedBody.length === 0) {
    return `---\n${serializedFrontmatter}\n---\n`;
  }

  return `---\n${serializedFrontmatter}\n---\n\n${normalizedBody}\n`;
}
