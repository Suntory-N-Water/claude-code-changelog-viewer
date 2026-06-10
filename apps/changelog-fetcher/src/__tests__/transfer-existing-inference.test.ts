import { describe, expect, test } from 'vitest';
import { createAnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import { createChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import { transferExistingInference } from '../domain/analysis/transfer-existing-inference';
import { createChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogVersion } from '../domain/changelog/changelog-version';
import { createInferenceResult } from '../domain/inference/inference-result';
import { findMissingInferenceItems } from '../usecase/inference-batch';

describe('transferExistingInference', () => {
  test('既存 inferred が null のとき、入力 analysis をそのまま返す', () => {
    const currentAnalysis = analysis([analyzed('- Added alpha')]);

    expect(transferExistingInference(currentAnalysis, null)).toBe(
      currentAnalysis,
    );
  });

  test('全項目が既存と一致するとき、推論情報を転写し missing が空になる', () => {
    const currentAnalysis = analysis([
      analyzed('- Added alpha'),
      analyzed('- Fixed beta'),
    ]);
    const result = transferExistingInference(
      currentAnalysis,
      analysis([
        inferred('- Added alpha', 'アルファを追加しました'),
        inferred('- Fixed beta', 'ベータを修正しました'),
      ]),
    );

    expect(result.items.map((item) => item.contentJa)).toEqual([
      'アルファを追加しました',
      'ベータを修正しました',
    ]);
    expect(result.items.map((item) => item.inference?.benefit)).toEqual([
      '利用者はアルファ機能をすぐ使えるようになります',
      '利用者はベータ不具合の影響を避けられます',
    ]);
    expect(findMissingInferenceItems(result)).toEqual([]);
  });

  test('末尾に1項目追加された場合、追加項目以外を転写し missing は追加項目1件のみになる', () => {
    const currentAnalysis = analysis([
      analyzed('- Added alpha'),
      analyzed('- Fixed beta'),
    ]);
    const result = transferExistingInference(
      currentAnalysis,
      analysis([inferred('- Added alpha', 'アルファを追加しました')]),
    );

    expect(result.items[0]?.contentJa).toBe('アルファを追加しました');
    expect(result.items[1]?.contentJa).toBeUndefined();
    expect(
      findMissingInferenceItems(result).map((item) => item.originalIndex),
    ).toEqual([1]);
  });

  test('末尾から1項目削除された場合、転写後の項目数が現 analysis に一致する', () => {
    const currentAnalysis = analysis([analyzed('- Added alpha')]);
    const result = transferExistingInference(
      currentAnalysis,
      analysis([
        inferred('- Added alpha', 'アルファを追加しました'),
        inferred('- Removed tail', '末尾を削除しました'),
      ]),
    );

    expect(result.items).toHaveLength(currentAnalysis.items.length);
    expect(result.items.map((item) => item.content)).toEqual(['- Added alpha']);
  });
});

function analyzed(content: string) {
  const entry = createChangelogEntry(content);

  return createAnalyzedChangelogEntry({
    content: entry.content,
    prefix: entry.prefix,
    relatedDocs: [
      { file: 'docs/example.md', snippets: ['example'], hitCount: 1 },
    ],
  });
}

function inferred(content: string, contentJa: string) {
  return createAnalyzedChangelogEntry({
    ...analyzed(content),
    contentJa,
    featureAreas: ['core'],
    inference: createInferenceResult({
      before: '利用者は変更前の挙動に合わせて手作業で対応していました',
      after: '利用者は変更後の挙動をそのまま利用できます',
      benefit: content.includes('Fixed')
        ? '利用者はベータ不具合の影響を避けられます'
        : '利用者はアルファ機能をすぐ使えるようになります',
    }),
  });
}

function analysis(items: ReturnType<typeof analyzed>[]) {
  return createChangelogAnalysis({
    version: createChangelogVersion('v1.0.0'),
    items,
  });
}
