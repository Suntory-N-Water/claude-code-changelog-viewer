import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  type IssueCorpusEntry,
  IssueCorpusEntrySchema,
} from '@claude-code-changelog-viewer/types';
import { z } from 'zod';

const IssuesFetchMetadataSchema = z.object({
  last_fetch: z.string(),
});
export type IssuesFetchMetadata = z.infer<typeof IssuesFetchMetadataSchema>;

export class IssuesCorpusStore {
  private readonly corpusDir: string;
  private readonly metadataPath: string;

  constructor(input: { corpusDir: string; metadataPath: string }) {
    this.corpusDir = input.corpusDir;
    this.metadataPath = input.metadataPath;
  }

  async loadEntry(issueNumber: number): Promise<IssueCorpusEntry | null> {
    const path = this.entryPath(issueNumber);
    if (!existsSync(path)) {
      return null;
    }
    const raw = await readFile(path, 'utf-8');
    return IssueCorpusEntrySchema.parse(JSON.parse(raw));
  }

  async saveEntry(entry: IssueCorpusEntry): Promise<void> {
    await mkdir(this.corpusDir, { recursive: true });
    const validated = IssueCorpusEntrySchema.parse(entry);
    await writeFile(
      this.entryPath(entry.number),
      `${JSON.stringify(validated, null, 2)}\n`,
      'utf-8',
    );
  }

  async listStoredNumbers(): Promise<number[]> {
    if (!existsSync(this.corpusDir)) {
      return [];
    }
    const files = await readdir(this.corpusDir);
    return files
      .filter((name) => name.endsWith('.json'))
      .map((name) => Number.parseInt(name.replace(/\.json$/, ''), 10))
      .filter((n) => Number.isInteger(n) && n > 0)
      .sort((a, b) => a - b);
  }

  async loadMetadata(): Promise<IssuesFetchMetadata | null> {
    if (!existsSync(this.metadataPath)) {
      return null;
    }
    const raw = await readFile(this.metadataPath, 'utf-8');
    return IssuesFetchMetadataSchema.parse(JSON.parse(raw));
  }

  async saveMetadata(metadata: IssuesFetchMetadata): Promise<void> {
    await mkdir(dirname(this.metadataPath), { recursive: true });
    await writeFile(
      this.metadataPath,
      `${JSON.stringify(metadata, null, 2)}\n`,
      'utf-8',
    );
  }

  private entryPath(issueNumber: number): string {
    return join(this.corpusDir, `${issueNumber}.json`);
  }
}
