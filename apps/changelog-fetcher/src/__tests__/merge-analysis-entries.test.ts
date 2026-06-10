import { describe, expect, it } from 'vitest';
import {
  type AnalyzedChangelogEntry,
  createAnalyzedChangelogEntry,
} from '../domain/analysis/analyzed-changelog-entry';
import { createChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import { mergeAnalysisEntries } from '../domain/analysis/merge-analysis-entries';
import type { ChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogVersion } from '../domain/changelog/changelog-version';

describe('解析済み項目の差分反映', () => {
  it('既存解析がない時、現在の全項目を検索対象にすること', () => {
    const currentEntries = [
      changelogEntry('- Added plan mode support'),
      changelogEntry('- Fixed resume from VS Code terminal'),
    ];

    const sut = mergeAnalysisEntries(currentEntries, null);

    expect(sut.entriesNeedingSearch.map((entry) => entry.content)).toEqual([
      '- Added plan mode support',
      '- Fixed resume from VS Code terminal',
    ]);
  });

  it('現在の項目が既存解析と同じ時、既存の関連ドキュメントを保持した解析結果を再構成できること', () => {
    const currentEntries = [
      changelogEntry('- Added plan mode support'),
      changelogEntry('- Fixed resume from VS Code terminal'),
    ];
    const existingAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support', 'docs/plan.md'),
      analyzedEntry('- Fixed resume from VS Code terminal', 'docs/vs-code.md'),
    ]);

    const sut = mergeAnalysisEntries(currentEntries, existingAnalysis);

    expect(filesFromMergeDecisions(sut.decisions, [])).toEqual([
      'docs/plan.md',
      'docs/vs-code.md',
    ]);
  });

  it('末尾に項目が追加された時、追加項目だけを検索対象にして現在の順序で解析結果を再構成できること', () => {
    const currentEntries = [
      changelogEntry('- Added plan mode support'),
      changelogEntry('- Fixed resume from VS Code terminal'),
      changelogEntry('- Updated MCP server reconnect behavior'),
    ];
    const existingAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support', 'docs/plan.md'),
      analyzedEntry('- Fixed resume from VS Code terminal', 'docs/vs-code.md'),
    ]);

    const sut = mergeAnalysisEntries(currentEntries, existingAnalysis);
    const searchedEntries = [
      analyzedEntry('- Updated MCP server reconnect behavior', 'docs/mcp.md'),
    ];

    expect(sut.entriesNeedingSearch.map((entry) => entry.content)).toEqual([
      '- Updated MCP server reconnect behavior',
    ]);
    expect(filesFromMergeDecisions(sut.decisions, searchedEntries)).toEqual([
      'docs/plan.md',
      'docs/vs-code.md',
      'docs/mcp.md',
    ]);
  });

  it('末尾から項目が削除された時、削除された解析項目を結果に残さないこと', () => {
    const currentEntries = [changelogEntry('- Added plan mode support')];
    const existingAnalysis = changelogAnalysis([
      analyzedEntry('- Added plan mode support', 'docs/plan.md'),
      analyzedEntry('- Removed old terminal behavior', 'docs/terminal.md'),
    ]);

    const sut = mergeAnalysisEntries(currentEntries, existingAnalysis);

    expect(
      sut.decisions.map((decision) =>
        decision.kind === 'existing' ? decision.entry.content : undefined,
      ),
    ).toEqual(['- Added plan mode support']);
  });

  it('同じ本文の項目が複数ある時、本文だけでなく位置が一致した項目だけを流用すること', () => {
    const duplicatedContent = '- Added settings validation';
    const currentEntries = [
      changelogEntry(duplicatedContent),
      changelogEntry('- Fixed settings migration'),
      changelogEntry(duplicatedContent),
    ];
    const existingAnalysis = changelogAnalysis([
      analyzedEntry(duplicatedContent, 'docs/settings-first.md'),
      analyzedEntry(duplicatedContent, 'docs/settings-second.md'),
    ]);

    const sut = mergeAnalysisEntries(currentEntries, existingAnalysis);
    const searchedEntries = [
      analyzedEntry('- Fixed settings migration', 'docs/settings-migration.md'),
      analyzedEntry(duplicatedContent, 'docs/settings-new-position.md'),
    ];

    expect(sut.entriesNeedingSearch.map((entry) => entry.content)).toEqual([
      '- Fixed settings migration',
      duplicatedContent,
    ]);
    expect(filesFromMergeDecisions(sut.decisions, searchedEntries)).toEqual([
      'docs/settings-first.md',
      'docs/settings-migration.md',
      'docs/settings-new-position.md',
    ]);
  });
});

function changelogEntry(value: string): ChangelogEntry {
  return createChangelogEntry(value);
}

function analyzedEntry(
  content: string,
  relatedDocFile: string,
): AnalyzedChangelogEntry {
  const entry = changelogEntry(content);

  return createAnalyzedChangelogEntry({
    content: entry.content,
    prefix: entry.prefix,
    relatedDocs: [
      { file: relatedDocFile, snippets: ['関連ドキュメント'], hitCount: 1 },
    ],
  });
}

function changelogAnalysis(items: AnalyzedChangelogEntry[]) {
  return createChangelogAnalysis({
    version: createChangelogVersion('v1.0.0'),
    items,
  });
}

function filesFromMergeDecisions(
  decisions: ReturnType<typeof mergeAnalysisEntries>['decisions'],
  searchedEntries: AnalyzedChangelogEntry[],
): (string | undefined)[] {
  return decisions.map((decision) => {
    if (decision.kind === 'existing') {
      return decision.entry.relatedDocs[0]?.file;
    }

    const searchedEntry = searchedEntries[decision.searchedIndex];
    return searchedEntry?.relatedDocs[0]?.file;
  });
}
