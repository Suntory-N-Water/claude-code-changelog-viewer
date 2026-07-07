#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import { z } from 'zod';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_DIR = join(__dirname, '..');

const log = getLogger({ name: 'eval-tie-issues' });

// 正解ラベル: entry_id は analysis の items[].id (sha256(content)[0:12])。
// analysis を再生成して content が変わると id も変わるため、突合できないラベルはエラーとして報告する。
const LabelSchema = z.object({
  version: z.string(),
  entry_id: z.string().length(12),
  issue_numbers: z.array(z.number().int().positive()).min(1),
});
const LabelsFileSchema = z.object({ labels: z.array(LabelSchema) });

async function main(): Promise<void> {
  const labelsPath = join(APP_DIR, 'eval', 'labels.json');
  const labelsRaw = await readFile(labelsPath, 'utf-8');
  const { labels } = LabelsFileSchema.parse(JSON.parse(labelsRaw));

  if (labels.length === 0) {
    log.error(
      'eval/labels.json にラベルがありません。{ version, entry_id, issue_numbers } を記入してから実行してください',
    );
    process.exit(1);
  }

  const versions = [...new Set(labels.map((l) => l.version))];
  const tiedByVersion = new Map<
    string,
    Map<string, { content: string; predicted: number[] }>
  >();
  for (const version of versions) {
    const tiedPath = join(APP_DIR, 'tied', `tied_${version}.json`);
    if (!existsSync(tiedPath)) {
      log.error(
        `tied ファイルが存在しません: ${tiedPath}（先に pnpm run tie:issues ${version} を実行してください）`,
      );
      process.exit(1);
    }
    const tiedRaw = await readFile(tiedPath, 'utf-8');
    const tied = AnalysisSchema.parse(JSON.parse(tiedRaw));
    tiedByVersion.set(
      version,
      new Map(
        tied.items.map((item) => [
          item.id,
          {
            content: item.content,
            predicted: (item.related_issues ?? [])
              .slice(0, 5)
              .map((issue) => issue.number),
          },
        ]),
      ),
    );
  }

  let totalHits = 0;
  let totalPredicted = 0;
  let totalCorrect = 0;
  let unmatchedLabels = 0;

  for (const label of labels) {
    const item = tiedByVersion.get(label.version)?.get(label.entry_id);
    if (!item) {
      unmatchedLabels += 1;
      log.error(
        `[${label.version}] entry_id=${label.entry_id} が tied に見つかりません（analysis 再生成で id が変わった可能性）`,
      );
      continue;
    }

    const correctSet = new Set(label.issue_numbers);
    const hits = item.predicted.filter((n) => correctSet.has(n));
    const missed = label.issue_numbers.filter(
      (n) => !item.predicted.includes(n),
    );
    totalHits += hits.length;
    totalPredicted += item.predicted.length;
    totalCorrect += correctSet.size;

    log.info(
      `[${label.version}] ${label.entry_id} hits=${hits.length}/${item.predicted.length} 正解=${label.issue_numbers.length}件 miss=[${missed.join(', ')}] | ${item.content.slice(0, 80)}`,
    );
  }

  if (unmatchedLabels === labels.length) {
    log.error('突合できたラベルが 1 件もありません');
    process.exit(1);
  }

  // micro 平均: precision@5 は「top5 として出力した件数のうち正解だった割合」、
  // recall@5 は「正解 issue のうち top5 に入った割合」
  const precision = totalPredicted === 0 ? 0 : totalHits / totalPredicted;
  const recall = totalCorrect === 0 ? 0 : totalHits / totalCorrect;

  log.info(
    `precision@5 = ${(precision * 100).toFixed(1)}% (${totalHits}/${totalPredicted})`,
  );
  log.info(
    `recall@5 = ${(recall * 100).toFixed(1)}% (${totalHits}/${totalCorrect})`,
  );
  log.info(
    `ラベル ${labels.length}件（突合不能 ${unmatchedLabels}件）/ 本番投入基準: precision@5 >= 60%`,
  );
}

main().catch((error) => {
  log.error('eval-tie-issues 失敗', { error: toError(error) });
  process.exit(1);
});
