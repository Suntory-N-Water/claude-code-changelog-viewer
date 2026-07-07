import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import type { AppLogger } from '@claude-code-changelog-viewer/common';
import {
  type IssueCorpusEntry,
  IssueCorpusEntrySchema,
} from '@claude-code-changelog-viewer/types';
import { z } from 'zod';

const BODY_CHAR_LIMIT = 8000;
const BATCH_SIZE = 100;

export type EmbeddingsPort = {
  batchEmbedContents(texts: string[]): Promise<number[][]>;
};

const EmbeddingRecordSchema = z.object({
  number: z.number().int().positive(),
  embedded_at: z.string(),
  embedding: z.array(z.number()),
});
export type EmbeddingRecord = z.infer<typeof EmbeddingRecordSchema>;

export type BuildIssuesEmbeddingsInput = {
  corpusDir: string;
  embeddingsPath: string;
  embeddings: EmbeddingsPort;
  logger: AppLogger;
};

export type BuildIssuesEmbeddingsResult = {
  embedded: number;
  skipped: number;
  total: number;
};

export async function buildIssuesEmbeddings(
  input: BuildIssuesEmbeddingsInput,
): Promise<BuildIssuesEmbeddingsResult> {
  const existing = await loadExistingEmbeddings(input.embeddingsPath);
  const targets = await pickTargets(input.corpusDir, existing);

  input.logger.info(
    `対象: total=${targets.length} skipped=${existing.size - Array.from(existing.keys()).filter((n) => !targets.find((t) => t.entry.number === n)).length}`,
  );

  const now = new Date().toISOString();
  const updated = new Map<number, EmbeddingRecord>(existing);
  let embeddedCount = 0;

  for (let i = 0; i < targets.length; i += BATCH_SIZE) {
    const batch = targets.slice(i, i + BATCH_SIZE);
    const texts = batch.map(({ entry }) => buildEmbedText(entry));
    let vectors: number[][];
    try {
      vectors = await input.embeddings.batchEmbedContents(texts);
    } catch (error) {
      await writeEmbeddings(input.embeddingsPath, updated);
      const remaining = targets.length - i;
      input.logger.error(
        `batch 失敗: 完了=${i}/${targets.length} 残=${remaining} 部分保存済み。再実行時は残 ${remaining} 件のみ処理されます`,
      );
      throw error;
    }
    if (vectors.length !== batch.length) {
      await writeEmbeddings(input.embeddingsPath, updated);
      throw new Error(
        `バッチ応答不整合: batch=${batch.length} vectors=${vectors.length}`,
      );
    }
    batch.forEach(({ entry }, index) => {
      const vector = vectors[index];
      if (!vector) {
        throw new Error(`vectors[${index}] が undefined`);
      }
      updated.set(entry.number, {
        number: entry.number,
        embedded_at: now,
        embedding: vector,
      });
    });
    embeddedCount += batch.length;
    await writeEmbeddings(input.embeddingsPath, updated);
    input.logger.info(
      `batch 完了: ${i + batch.length}/${targets.length} (jsonl 書き出し済み)`,
    );
  }

  return {
    embedded: embeddedCount,
    skipped:
      existing.size -
      targets.filter((t) => existing.has(t.entry.number)).length,
    total: updated.size,
  };
}

async function loadExistingEmbeddings(
  path: string,
): Promise<Map<number, EmbeddingRecord>> {
  if (!existsSync(path)) {
    return new Map();
  }
  const raw = await readFile(path, 'utf-8');
  const map = new Map<number, EmbeddingRecord>();
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      continue;
    }
    const record = EmbeddingRecordSchema.parse(JSON.parse(trimmed));
    map.set(record.number, record);
  }
  return map;
}

async function pickTargets(
  corpusDir: string,
  existing: Map<number, EmbeddingRecord>,
): Promise<{ entry: IssueCorpusEntry }[]> {
  if (!existsSync(corpusDir)) {
    return [];
  }
  const files = (await readdir(corpusDir)).filter((n) => n.endsWith('.json'));
  const targets: { entry: IssueCorpusEntry }[] = [];
  for (const name of files) {
    const raw = await readFile(join(corpusDir, name), 'utf-8');
    const entry = IssueCorpusEntrySchema.parse(JSON.parse(raw));
    const previous = existing.get(entry.number);
    if (!previous || previous.embedded_at < entry.updated_at) {
      targets.push({ entry });
    }
  }
  return targets;
}

async function writeEmbeddings(
  path: string,
  records: Map<number, EmbeddingRecord>,
): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const sorted = [...records.values()].sort((a, b) => a.number - b.number);
  const body = sorted.map((r) => JSON.stringify(r)).join('\n');
  await writeFile(path, body ? `${body}\n` : '', 'utf-8');
}

function buildEmbedText(entry: IssueCorpusEntry): string {
  const body = entry.body.slice(0, BODY_CHAR_LIMIT);
  return `${entry.title}\n\n${body}`;
}
