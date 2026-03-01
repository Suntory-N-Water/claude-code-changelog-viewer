import { exec } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import type { AppLogger } from '@claude-code-changelog-viewer/common';

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

export class ClaudeDocsFetcher {
  private readonly baseUrl = 'https://code.claude.com/docs/en';
  private readonly docsMapUrl = `${this.baseUrl}/claude_code_docs_map.md`;
  private readonly llmsUrl = 'https://code.claude.com/docs/llms.txt';
  private readonly docsDir: string;
  private readonly metadataDir: string;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000; // 1 second
  private readonly log: AppLogger;

  constructor(rootDir: string = '.', logger: AppLogger) {
    this.docsDir = path.join(rootDir, 'docs', 'en');
    this.metadataDir = path.join(rootDir, 'metadata');
    this.log = logger.child({ component: 'ClaudeDocsFetcher' });
  }

  /**
   * Initialize directories
   */
  async init(): Promise<void> {
    await fs.mkdir(this.docsDir, { recursive: true });
    await fs.mkdir(this.metadataDir, { recursive: true });
    this.log.msg('APLG0004', { params: ['ディレクトリ'] });
  }

  /**
   * Fetch docs map to get list of all documentation pages
   */
  async fetchDocsMap(): Promise<DocInfo[]> {
    this.log.msg('APLG0003', { params: ['ドキュメントマップ'] });

    try {
      const response = await this.fetchWithRetry(this.docsMapUrl);
      const content = await response.text();

      // Save the docs map
      await fs.writeFile(
        path.join(this.metadataDir, 'docs_map.md'),
        content,
        'utf-8',
      );

      // Parse the markdown to extract document URLs
      const docs = this.parseDocsMap(content);
      this.log.msg('APLG0010', {
        params: ['ドキュメントページ'],
        attrs: { 'doc.count': docs.length },
      });

      return docs;
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0015', { params: ['ドキュメントマップ'], error });
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

    // Look for markdown links in the format [Title](url)
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
    this.log.msg('APLG0003', { params: ['llms.txt'] });

    try {
      const response = await this.fetchWithRetry(this.llmsUrl);
      const content = await response.text();

      // Save the llms.txt
      await fs.writeFile(
        path.join(this.metadataDir, 'llms.txt'),
        content,
        'utf-8',
      );

      // Parse to extract document URLs
      const docs = this.parseLlmsTxt(content);
      this.log.msg('APLG0010', {
        params: ['llms.txt ページ'],
        attrs: { 'doc.count': docs.length },
      });

      return docs;
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0011', { params: ['llms.txt'], error });
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

    // Match full URLs ending with .md
    const urlRegex = /https:\/\/code\.claude\.com\/docs\/en\/([^\s)]+\.md)/g;

    let match: RegExpExecArray | null = null;
    match = urlRegex.exec(content);
    while (match !== null) {
      const url = match[0];
      const pathPart = match[1];
      if (!url || !pathPart) {
        continue;
      }

      // Extract title from path (remove .md and convert to readable format)
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
    const filenameMap = new Map<string, string>(); // filename -> url

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
        // Same URL exists - update title if docs_map has a better one
        const existing = urlMap.get(key);
        if (existing && doc.title && doc.title !== existing.title) {
          urlMap.set(key, { ...existing, title: doc.title });
        }
      } else if (filenameMap.has(filenameKey)) {
        // Same filename but different path - llms.txt path is authoritative, skip
        // But update the title if docs_map has a better one
        const existingUrl = filenameMap.get(filenameKey);
        if (existingUrl) {
          const existing = urlMap.get(existingUrl);
          if (existing && doc.title && doc.title !== existing.title) {
            urlMap.set(existingUrl, { ...existing, title: doc.title });
          }
        }
      } else {
        // New document not in llms.txt
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
      // Create subdirectory if needed (e.g., for sdk/migration-guide.md)
      const fileDir = path.dirname(filePath);
      if (fileDir !== this.docsDir) {
        await fs.mkdir(fileDir, { recursive: true });
      }

      const response = await this.fetchWithRetry(docInfo.url);
      const markdown = await response.text();

      // Add front matter with metadata
      const frontMatter = this.createFrontMatter(docInfo);
      const fullContent = frontMatter + markdown;

      // Save the file
      await fs.writeFile(filePath, fullContent, 'utf-8');

      return {
        success: true,
        filename,
        content: fullContent,
      };
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0015', {
          params: ['ドキュメント'],
          attrs: { 'doc.title': docInfo.title },
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
    // Extract path after /docs/en/
    const match = url.match(/\/docs\/en\/(.+\.md)/);
    const captured = match?.[1];
    if (captured) {
      // Remove query parameters and hash
      return captured.split(/[?#]/)[0] ?? captured;
    }

    // Fallback: existing logic
    const lastPart = url.split('/').at(-1) ?? '';
    const filename = lastPart.split(/[?#]/)[0] ?? '';
    return filename.endsWith('.md') ? filename : `${filename}.md`;
  }

  /**
   * Fetch with retry logic
   */
  private async fetchWithRetry(
    url: string,
    retries = 0,
  ): Promise<{
    ok: boolean;
    status: number;
    statusText: string;
    text: () => Promise<string>;
  }> {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Claude-Code-Doc-Tracker/1.0',
          Accept: 'text/markdown, text/plain, */*',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return response;
    } catch (error) {
      if (retries < this.maxRetries) {
        this.log.msg('APLG0014', {
          attrs: {
            'retry.attempt': retries + 1,
            'retry.max': this.maxRetries,
            'request.url': url,
          },
        });
        await this.sleep(this.retryDelay * 2 ** retries); // Exponential backoff
        return this.fetchWithRetry(url, retries + 1);
      }
      throw error;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
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
      this.log.msg('APLG0013', { params: ['git diff'] });
      return true;
    }
  }

  /**
   * Save metadata
   */
  private async saveMetadata(data: Record<string, unknown>): Promise<void> {
    const metadataPath = path.join(this.metadataDir, 'last_update.json');

    try {
      let existing = {};
      try {
        const content = await fs.readFile(metadataPath, 'utf-8');
        existing = JSON.parse(content);
      } catch {
        // File doesn't exist yet
      }

      const metadata = {
        ...existing,
        ...data,
      };

      await fs.writeFile(
        metadataPath,
        JSON.stringify(metadata, null, 2),
        'utf-8',
      );
    } catch (error) {
      if (error instanceof Error) {
        this.log.msg('APLG0017', { params: ['メタデータ'], error });
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
      // Directory doesn't exist
    }

    return files;
  }

  /**
   * Sync local files with expected docs (remove files not in expected list)
   */
  async syncLocalFiles(expectedDocs: DocInfo[]): Promise<number> {
    // Get list of expected files
    const expectedFiles = new Set(
      expectedDocs.map((doc) => this.getFilenameFromUrl(doc.url)),
    );

    // Get all .md files recursively
    const actualFiles = await this.getAllMarkdownFiles(this.docsDir);

    // Find files to delete (exist locally but not in expected list)
    const filesToDelete = actualFiles.filter(
      (file) => !expectedFiles.has(file),
    );

    // Delete orphaned files
    let deletedCount = 0;
    for (const file of filesToDelete) {
      const filePath = path.join(this.docsDir, file);
      try {
        await fs.unlink(filePath);
        this.log.msg('APLG0005', {
          params: ['不要なファイル'],
          attrs: { 'file.name': file },
        });
        deletedCount++;
      } catch (error) {
        if (error instanceof Error) {
          this.log.msg('APLG0016', {
            params: ['ファイル'],
            attrs: { 'file.name': file },
            error,
          });
        }
      }
    }

    if (deletedCount > 0) {
      this.log.msg('APLG0006', {
        params: ['不要なファイル'],
        attrs: { 'cleanup.count': deletedCount },
      });
    }

    return deletedCount;
  }

  /**
   * Fetch all documentation
   * Fetches both docs_map and llms.txt in parallel for comprehensive coverage
   */
  async fetchAllDocs(): Promise<void> {
    this.log.msg('APLG0001', { params: ['ドキュメントの取得'] });

    // Initialize directories
    await this.init();

    // Fetch both docs_map and llms.txt in parallel
    this.log.msg('APLG0003', { params: ['ドキュメントソース'] });
    const [docsMapDocs, llmsDocs] = await Promise.all([
      this.fetchDocsMap(),
      this.fetchLlmsTxt(),
    ]);

    // Merge document lists (docs_map has better titles, llms.txt may have newer docs)
    const docs = this.mergeDocLists(docsMapDocs, llmsDocs);
    this.log.msg('APLG0010', {
      params: ['マージ後のユニークドキュメント'],
      attrs: { 'doc.total': docs.length },
    });

    if (docs.length === 0) {
      this.log.msg('APLG0012', { params: ['ドキュメントページ'] });
      return;
    }

    // Sync local files (remove files not in merged list)
    const deletedCount = await this.syncLocalFiles(docs);

    // Fetch documents in batches to avoid overwhelming the server
    const batchSize = 5;
    const results: FetchResult[] = [];

    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = docs.slice(i, i + batchSize);
      const batchPromises = batch.map((doc) => this.fetchDoc(doc));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);

      // Small delay between batches
      if (i + batchSize < docs.length) {
        await this.sleep(500);
      }
    }

    // Report results
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
          params: ['ドキュメント'],
          attrs: {
            'doc.filename': f.filename,
            'exception.message': f.error,
          },
        });
      }
    }

    if (deletedCount > 0) {
      this.log.msg('APLG0006', {
        params: ['不要なドキュメント'],
        attrs: { 'cleanup.count': deletedCount },
      });
    }

    // Check if there are changes in docs directory
    const hasChanges = await this.hasDocsChanges();

    // Save summary metadata (include lastMapUpdate only if docs changed)
    const metadata: Record<string, unknown> = {
      totalDocs: docs.length,
      successfulFetch: successful,
      failedFetch: failed.length,
      failedFiles: failed.map((f) => f.filename),
      deletedFiles: deletedCount,
    };

    if (hasChanges) {
      const now = `${new Date().toISOString().replace('T', ' ').substring(0, 19)} UTC`;
      metadata['lastMapUpdate'] = now;
      this.log.msg('APLG0007', { params: ['ドキュメント'] });
    } else {
      this.log.msg('APLG0008', { params: ['ドキュメント'] });
    }

    await this.saveMetadata(metadata);

    this.log.msg('APLG0002', { params: ['ドキュメントの取得'] });
  }
}
