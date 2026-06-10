import { describe, expect, it } from 'vitest';
import {
  type AnalyzedChangelogEntry,
  createAnalyzedChangelogEntry,
} from '../domain/analysis/analyzed-changelog-entry';
import { createChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import { createChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogVersion } from '../domain/changelog/changelog-version';
import { createInferenceResult } from '../domain/inference/inference-result';
import { findMissingInferenceItems } from '../usecase/inference-batch';
import { transferExistingInference } from '../usecase/transfer-existing-inference';

describe('既存推論の引き継ぎ', () => {
  it('既存推論がない時、現在の解析結果を変更しないこと', () => {
    const currentAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support'),
    ]);

    const result = transferExistingInference(currentAnalysis, null);

    expect(result).toEqual(currentAnalysis);
  });

  it('現在の項目が既存推論と同じ時、翻訳・推論・機能領域を引き継ぐこと', () => {
    const currentAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support'),
      analyzedEntry('- Fixed resume from VS Code terminal'),
    ]);
    const existingInferred = changelogAnalysis([
      inferredEntry(
        '- Added plan mode support',
        'プランモードが利用できるようになりました',
        'Plan',
      ),
      inferredEntry(
        '- Fixed resume from VS Code terminal',
        'VS Code ターミナルからの再開問題を修正しました',
        'IDE',
      ),
    ]);

    const result = transferExistingInference(currentAnalysis, existingInferred);

    expect(
      result.items.map((item) => ({
        contentJa: item.contentJa,
        featureAreas: item.featureAreas,
        benefit: item.inference?.benefit,
      })),
    ).toEqual([
      {
        contentJa: 'プランモードが利用できるようになりました',
        featureAreas: ['Plan'],
        benefit: '利用者は対象機能の恩恵をすぐ確認できます',
      },
      {
        contentJa: 'VS Code ターミナルからの再開問題を修正しました',
        featureAreas: ['IDE'],
        benefit: '利用者は対象機能の恩恵をすぐ確認できます',
      },
    ]);
    expect(findMissingInferenceItems(result)).toEqual([]);
  });

  it('末尾に項目が追加された時、追加項目だけを未推論として残すこと', () => {
    const currentAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support'),
      analyzedEntry('- Updated MCP server reconnect behavior'),
    ]);
    const existingInferred = changelogAnalysis([
      inferredEntry(
        '- Added plan mode support',
        'プランモードが利用できるようになりました',
        'Plan',
      ),
    ]);

    const result = transferExistingInference(currentAnalysis, existingInferred);

    expect(result.items[0]?.contentJa).toBe(
      'プランモードが利用できるようになりました',
    );
    expect(
      findMissingInferenceItems(result).map((item) => item.entry.content),
    ).toEqual(['- Updated MCP server reconnect behavior']);
  });

  it('末尾から項目が削除された時、削除された推論項目を結果に残さないこと', () => {
    const currentAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support'),
    ]);
    const existingInferred = changelogAnalysis([
      inferredEntry(
        '- Added plan mode support',
        'プランモードが利用できるようになりました',
        'Plan',
      ),
      inferredEntry(
        '- Removed legacy terminal behavior',
        '古いターミナル挙動が削除されました',
        'Settings',
      ),
    ]);

    const result = transferExistingInference(currentAnalysis, existingInferred);

    expect(result.items.map((item) => item.content)).toEqual([
      '- Added plan mode support',
    ]);
    expect(findMissingInferenceItems(result)).toEqual([]);
  });
});

function analyzedEntry(content: string): AnalyzedChangelogEntry {
  const entry = createChangelogEntry(content);

  return createAnalyzedChangelogEntry({
    content: entry.content,
    prefix: entry.prefix,
    relatedDocs: [
      { file: 'docs/example.md', snippets: ['関連ドキュメント'], hitCount: 1 },
    ],
  });
}

function inferredEntry(
  content: string,
  contentJa: string,
  featureArea: string,
): AnalyzedChangelogEntry {
  return createAnalyzedChangelogEntry({
    ...analyzedEntry(content),
    contentJa,
    featureAreas: [featureArea],
    inference: createInferenceResult({
      before: '変更前は利用者が手作業で問題を避ける必要がありました',
      after: '変更後は利用者が追加作業なしで同じ目的を達成できます',
      benefit: '利用者は対象機能の恩恵をすぐ確認できます',
    }),
  });
}

function changelogAnalysis(items: AnalyzedChangelogEntry[]) {
  return createChangelogAnalysis({
    version: createChangelogVersion('v1.0.0'),
    items,
  });
}
