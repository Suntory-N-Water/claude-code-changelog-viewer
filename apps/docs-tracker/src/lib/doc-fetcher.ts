import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import {
  cleanMarkdown,
  getLogger,
  toError,
  type AppLogger,
} from '@claude-code-changelog-viewer/common';
import { z } from 'zod';
import { fetchWithRetry } from './fetch-with-retry';
import { atomicWriteFile } from './atomic-write';

const docFetchMetadataSchema = z.object({
  totalDocs: z.number(),
  successfulFetch: z.number(),
  failedFetch: z.number(),
  failedFiles: z.array(z.string()),
  deletedFiles: z.number(),
  lastMapUpdate: z.string().optional(),
});

const partialDocFetchMetadataSchema = docFetchMetadataSchema.partial();

const execAsync = promisify(exec);

type DocInfo = {
  title: string;
  url: string;
  lastUpdated?: string;
};

type FetchResult = {
  success: boolean;
  filename: string;
  content?: string;
  error?: string;
};

type DocFetchMetadata = z.infer<typeof docFetchMetadataSchema>;
type PartialDocFetchMetadata = z.infer<typeof partialDocFetchMetadataSchema>;

export class ClaudeDocsFetcher {
  private docsMapUrl =
    'https://code.claude.com/docs/en/claude_code_docs_map.md';
  private llmsUrl = 'https://code.claude.com/docs/llms.txt';
  private docsDir: string;
  private metadataDir: string;
  private log: AppLogger;

  constructor(rootDir: string = '.') {
    this.docsDir = path.join(rootDir, 'docs', 'en');
    this.metadataDir = path.join(rootDir, 'metadata');
    this.log = getLogger({ name: 'docs-tracker' }).child({
      component: 'ClaudeDocsFetcher',
    });
  }

  /**
   * Initialize directories
   */
  async init(): Promise<void> {
    await fs.mkdir(this.docsDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
    this.log.msg('APLG0004', { attrs: { arg0: 'ディレクトリ' } });
  }

  /**
   * Fetch docs map to get list of all documentation pages
   */
  async fetchDocsMap(): Promise<DocInfo[]> {
    this.log.msg('APLG0003', { attrs: { arg0: 'ドキュメントマップ' } });

    try {
      const response = await fetchWithRetry({
        accept: 'text/markdown, text/plain, */*',
        url: this.docsMapUrl,
      });
      const content = await response.text();

      await atomicWriteFile(
        path.join(this.metadataDir, 'docs_map.md'),
        content,
      );

      const docs = this.parseDocsMap(content);
      this.log.msg('APLG0010', {
        attrs: { arg0: 'ドキュメントページ', 'doc.count': docs.length },
      });

      return docs;
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0015', {
          attrs: { arg0: 'ドキュメントマップ' },
          error,
        });
      }
      throw error;
    }
  }

  /**
   * Parse the docs map markdown to extract document information
   */
  private parseDocsMap(content: string): DocInfo[] {
    const docs: DocInfo[] = [];
    const lines = content.split('\n');

    // Only match full URLs ending with .md to avoid inline relative links
    const linkRegex = /\[([^\]]+)\]\((https:\/\/[^)]+\.md)\)/g;

    for (const line of lines) {
      let match: RegExpExecArray | null = null;
      match = linkRegex.exec(line);
      while (match !== null) {
        const title = match[1];
        const url = match[2];
        if (!title || !url) {
          continue;
        }
        docs.push({
          title: title.trim(),
          url,
        });
        match = linkRegex.exec(line);
      }
    }

    return docs;
  }

  /**
   * Fetch llms.txt to get list of all documentation URLs
   */
  async fetchLlmsTxt(): Promise<DocInfo[]> {
    this.log.msg('APLG0003', { attrs: { arg0: 'llms.txt' } });

    try {
      const response = await fetchWithRetry({
        accept: 'text/markdown, text/plain, */*',
        url: this.llmsUrl,
      });
      const content = await response.text();

      await atomicWriteFile(path.join(this.metadataDir, 'llms.txt'), content);

      const docs = this.parseLlmsTxt(content);
      this.log.msg('APLG0010', {
        attrs: { arg0: 'llms.txt ページ', 'doc.count': docs.length },
      });

      return docs;
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0011', { attrs: { arg0: 'llms.txt' }, error });
      }
      // Return empty array on failure (fallback to docs_map only)
      return [];
    }
  }

  /**
   * Parse llms.txt to extract documentation URLs
   */
  private parseLlmsTxt(content: string): DocInfo[] {
    const docs: DocInfo[] = [];

    const urlRegex = /https:\/\/code\.claude\.com\/docs\/en\/([^\s)]+\.md)/g;

    let match: RegExpExecArray | null = null;
    match = urlRegex.exec(content);
    while (match !== null) {
      const url = match[0];
      const pathPart = match[1];
      if (!url || !pathPart) {
        continue;
      }

      const title = pathPart.replace(/\.md$/, '').split('/').pop() ?? pathPart;

      docs.push({ title, url });
      match = urlRegex.exec(content);
    }

    return docs;
  }

  /**
   * Merge document lists from multiple sources
   * llms.txt is considered the authoritative source for URLs
   * Detects filename duplicates (e.g., migration-guide.md vs sdk/migration-guide.md)
   */
  private mergeDocLists(
    docsMapDocs: DocInfo[],
    llmsDocs: DocInfo[],
  ): DocInfo[] {
    const urlMap = new Map<string, DocInfo>();
    const filenameMap = new Map<string, string>();

    // Add llms.txt entries first (authoritative paths)
    for (const doc of llmsDocs) {
      const key = doc.url.toLowerCase();
      const filename = this.getFilenameFromUrl(doc.url).split('/').pop() || '';
      urlMap.set(key, doc);
      filenameMap.set(filename.toLowerCase(), key);
    }

    // Add docs_map entries (better titles, but check for path conflicts)
    for (const doc of docsMapDocs) {
      const key = doc.url.toLowerCase();
      const filename = this.getFilenameFromUrl(doc.url).split('/').pop() || '';
      const filenameKey = filename.toLowerCase();

      if (urlMap.has(key)) {
        const existing = urlMap.get(key);
        if (existing && doc.title && doc.title !== existing.title) {
          urlMap.set(key, { ...existing, title: doc.title });
        }
      } else if (filenameMap.has(filenameKey)) {
        // Same filename but different path - llms.txt path is authoritative, skip
        const existingUrl = filenameMap.get(filenameKey);
        if (existingUrl) {
          const existing = urlMap.get(existingUrl);
          if (existing && doc.title && doc.title !== existing.title) {
            urlMap.set(existingUrl, { ...existing, title: doc.title });
          }
        }
      } else {
        urlMap.set(key, doc);
        filenameMap.set(filenameKey, key);
      }
    }

    return Array.from(urlMap.values());
  }

  /**
   * Fetch a single documentation page
   */
  async fetchDoc(docInfo: DocInfo): Promise<FetchResult> {
    const filename = this.getFilenameFromUrl(docInfo.url);
    const filePath = path.join(this.docsDir, filename);

    this.log.debug('ドキュメントを取得しています', {
      'doc.title': docInfo.title,
      'doc.filename': filename,
    });

    try {
      const fileDir = path.dirname(filePath);
      if (fileDir !== this.docsDir) {
        await fs.mkdir(fileDir, { recursive: true });
      }

      const response = await fetchWithRetry({
        accept: 'text/markdown, text/plain, */*',
        url: docInfo.url,
      });
      const rawMarkdown = await response.text();
      const markdown = await cleanMarkdown(rawMarkdown);

      const frontMatter = this.createFrontMatter(docInfo);
      const fullContent = frontMatter + markdown;

      await atomicWriteFile(filePath, fullContent);

      return {
        success: true,
        filename,
        content: fullContent,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0015', {
          attrs: { arg0: 'ドキュメント', 'doc.title': docInfo.title },
          error,
        });
      }
      return {
        success: false,
        filename,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create front matter for markdown files
   */
  private createFrontMatter(docInfo: DocInfo): string {
    return `---
title: ${docInfo.title}
source: ${docInfo.url}
---

`;
  }

  /**
   * Get filename from URL, preserving subdirectory structure
   * e.g., https://code.claude.com/docs/en/sdk/migration-guide.md -> sdk/migration-guide.md
   */
  private getFilenameFromUrl(url: string): string {
    const match = url.match(/\/docs\/en\/(.+\.md)/);
    const captured = match?.[1];
    if (captured) {
      return captured.split(/[?#]/)[0] ?? captured;
    }

    const lastPart = url.split('/').at(-1) ?? '';
    const filename = lastPart.split(/[?#]/)[0] ?? '';
    return filename.endsWith('.md') ? filename : `${filename}.md`;
  }

  /**
   * Check if there are changes in docs directory
   */
  private async hasDocsChanges(): Promise<boolean> {
    try {
      const { stdout } = await execAsync(
        'git diff --quiet docs/en/ || echo "changed"',
      );
      return stdout.trim() === 'changed';
    } catch (_error) {
      // If git command fails (e.g., not a git repo), assume there are changes
      this.log.msg('APLG0013', { attrs: { arg0: 'git diff' } });
      return true;
    }
  }

  /**
   * Save metadata
   */
  private async saveMetadata(data: DocFetchMetadata): Promise<void> {
    const metadataPath = path.join(this.metadataDir, 'last_update.json');

    try {
      let existing: PartialDocFetchMetadata = {};
      try {
        const content = await fs.readFile(metadataPath, 'utf-8');
        existing = partialDocFetchMetadataSchema.parse(JSON.parse(content));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          this.log.warn('前回の Docs metadata を読み込めませんでした', {
            'file.path': metadataPath,
            'exception.message': toError(error).message,
          });
        }
      }

      const metadata = docFetchMetadataSchema.parse({ ...existing, ...data });

      await atomicWriteFile(metadataPath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0017', { attrs: { arg0: 'メタデータ' }, error });
      }
    }
  }

  /**
   * Get all markdown files recursively from a directory
   */
  private async getAllMarkdownFiles(
    dir: string,
    prefix = '',
  ): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;

        if (entry.isDirectory()) {
          const subFiles = await this.getAllMarkdownFiles(
            path.join(dir, entry.name),
            relativePath,
          );
          files.push(...subFiles);
        } else if (entry.name.endsWith('.md')) {
          files.push(relativePath);
        }
      }
    } catch {
      // ディレクトリが存在しない
    }

    return files;
  }

  /**
   * Sync local files with expected docs (remove files not in expected list)
   */
  async syncLocalFiles(expectedDocs: DocInfo[]): Promise<number> {
    const expectedFiles = new Set(
      expectedDocs.map((doc) => this.getFilenameFromUrl(doc.url)),
    );

    const actualFiles = await this.getAllMarkdownFiles(this.docsDir);

    const filesToDelete = actualFiles.filter(
      (file) => !expectedFiles.has(file),
    );

    let deletedCount = 0;
    for (const file of filesToDelete) {
      const filePath = path.join(this.docsDir, file);
      try {
        await fs.unlink(filePath);
        this.log.msg('APLG0005', {
          attrs: { arg0: '不要なファイル', 'file.name': file },
        });
        deletedCount += 1;
      } catch (error) {
        if (error instanceof Error) {
          this.log.msg('APLG0016', {
            attrs: { arg0: 'ファイル', 'file.name': file },
            error,
          });
        }
      }
    }

    if (deletedCount > 0) {
      this.log.msg('APLG0006', {
        attrs: { arg0: '不要なファイル', 'cleanup.count': deletedCount },
      });
    }

    return deletedCount;
  }

  /**
   * Fetch all documentation
   * Fetches both docs_map and llms.txt in parallel for comprehensive coverage
   */
  async fetchAllDocs(): Promise<void> {
    this.log.msg('APLG0001', { attrs: { arg0: 'ドキュメントの取得' } });

    await this.init();

    this.log.msg('APLG0003', { attrs: { arg0: 'ドキュメントソース' } });
    const [docsMapDocs, llmsDocs] = await Promise.all([
      this.fetchDocsMap(),
      this.fetchLlmsTxt(),
    ]);

    // Merge document lists (docs_map has better titles, llms.txt may have newer docs)
    const docs = this.mergeDocLists(docsMapDocs, llmsDocs);
    this.log.msg('APLG0010', {
      attrs: {
        arg0: 'マージ後のユニークドキュメント',
        'doc.total': docs.length,
      },
    });

    if (docs.length === 0) {
      this.log.msg('APLG0012', { attrs: { arg0: 'ドキュメントページ' } });
      return;
    }

    const deletedCount = await this.syncLocalFiles(docs);

    // Fetch documents in batches to avoid overwhelming the server
    const batchSize = 5;
    const results: FetchResult[] = [];

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const batchPromises = batch.map((doc) => this.fetchDoc(doc));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      if (i + batchSize < docs.length) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success);

    this.log.msg('APLG0009', {
      attrs: {
        'fetch.successful': successful,
        'fetch.total': docs.length,
        'fetch.failed': failed.length,
      },
    });

    if (failed.length > 0) {
      for (const f of failed) {
        this.log.msg('APLG0015', {
          attrs: {
            arg0: 'ドキュメント',
            'doc.filename': f.filename,
            'exception.message': f.error,
          },
        });
      }
    }

    if (deletedCount > 0) {
      this.log.msg('APLG0006', {
        attrs: { arg0: '不要なドキュメント', 'cleanup.count': deletedCount },
      });
    }

    const hasChanges = await this.hasDocsChanges();

    // Save summary metadata (include lastMapUpdate only if docs changed)
    const metadata: DocFetchMetadata = {
      totalDocs: docs.length,
      successfulFetch: successful,
      failedFetch: failed.length,
      failedFiles: failed.map((f) => f.filename),
      deletedFiles: deletedCount,
    };

    if (hasChanges) {
      const now = `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;
      metadata.lastMapUpdate = now;
      this.log.msg('APLG0007', { attrs: { arg0: 'ドキュメント' } });
    } else {
      this.log.msg('APLG0008', { attrs: { arg0: 'ドキュメント' } });
    }

    await this.saveMetadata(metadata);

    this.log.msg('APLG0002', { attrs: { arg0: 'ドキュメントの取得' } });
  }
}
