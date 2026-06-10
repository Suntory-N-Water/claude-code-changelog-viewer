import { describe, expect, test } from 'vitest';
import { createAnalyzedChangelogEntry } from '../domain/analysis/analyzed-changelog-entry';
import { createChangelogAnalysis } from '../domain/analysis/changelog-analysis';
import { mergeAnalysisEntries } from '../domain/analysis/merge-analysis-entries';
import type { ChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogEntry } from '../domain/changelog/changelog-entry';
import { createChangelogVersion } from '../domain/changelog/changelog-version';

describe('mergeAnalysisEntries', () => {
  test('既存 analysis が null のとき、全項目が needsSearch に入る', () => {
    const entries = [entry('- Added alpha'), entry('- Fixed beta')];

    expect(mergeAnalysisEntries(entries, null)).toEqual({
      reused: [],
      needsSearch: entries,
      orderedSlots: [
        { kind: 'needsSearch', needsSearchIndex: 0 },
        { kind: 'needsSearch', needsSearchIndex: 1 },
      ],
    });
  });

  test('全項目が既存と一致するとき、全項目が reused に入り needsSearch が空になる', () => {
    const entries = [entry('- Added alpha'), entry('- Fixed beta')];
    const existingAnalysis = analysis([
      analyzed('- Added alpha', 'docs/alpha.md'),
      analyzed('- Fixed beta', 'docs/beta.md'),
    ]);

    const result = mergeAnalysisEntries(entries, existingAnalysis);

    expect(result.reused).toEqual(existingAnalysis.items);
    expect(result.needsSearch).toEqual([]);
    expect(result.orderedSlots).toEqual([
      { kind: 'reused', reusedIndex: 0 },
      { kind: 'reused', reusedIndex: 1 },
    ]);
  });

  test('末尾に1項目追加された場合、新規1件のみ needsSearch に入り既存項目は relatedDocs を保持する', () => {
    const entries = [
      entry('- Added alpha'),
      entry('- Fixed beta'),
      entry('- Updated gamma'),
    ];
    const existingAnalysis = analysis([
      analyzed('- Added alpha', 'docs/alpha.md'),
      analyzed('- Fixed beta', 'docs/beta.md'),
    ]);

    const result = mergeAnalysisEntries(entries, existingAnalysis);

    expect(result.reused.map((item) => item.relatedDocs)).toEqual([
      [{ file: 'docs/alpha.md', snippets: ['alpha'], hitCount: 1 }],
      [{ file: 'docs/beta.md', snippets: ['beta'], hitCount: 1 }],
    ]);
    expect(result.needsSearch).toEqual([entries[2]]);
    expect(result.orderedSlots).toEqual([
      { kind: 'reused', reusedIndex: 0 },
      { kind: 'reused', reusedIndex: 1 },
      { kind: 'needsSearch', needsSearchIndex: 0 },
    ]);
  });

  test('末尾から1項目削除された場合、出力スロット数が現項目数に一致し削除項目を含まない', () => {
    const entries = [entry('- Added alpha')];
    const result = mergeAnalysisEntries(
      entries,
      analysis([
        analyzed('- Added alpha', 'docs/alpha.md'),
        analyzed('- Removed old tail', 'docs/old.md'),
      ]),
    );

    expect(result.orderedSlots).toHaveLength(entries.length);
    expect(result.reused.map((item) => item.content)).toEqual([
      '- Added alpha',
    ]);
    expect(result.needsSearch).toEqual([]);
  });

  test('同じ content が複数現れる重複ケースで index 位置に従って流用と再検索を振り分ける', () => {
    const duplicated = '- Added duplicated';
    const entries = [
      entry(duplicated),
      entry('- Fixed inserted'),
      entry(duplicated),
    ];
    const result = mergeAnalysisEntries(
      entries,
      analysis([
        analyzed(duplicated, 'docs/first.md'),
        analyzed(duplicated, 'docs/second.md'),
      ]),
    );

    expect(result.reused.map((item) => item.relatedDocs[0]?.file)).toEqual([
      'docs/first.md',
    ]);
    expect(result.needsSearch.map((item) => item.content)).toEqual([
      '- Fixed inserted',
      duplicated,
    ]);
    expect(result.orderedSlots).toEqual([
      { kind: 'reused', reusedIndex: 0 },
      { kind: 'needsSearch', needsSearchIndex: 0 },
      { kind: 'needsSearch', needsSearchIndex: 1 },
    ]);
  });
});

function entry(value: string): ChangelogEntry {
  return createChangelogEntry(value);
}

function analyzed(content: string, file: string) {
  const entry = createChangelogEntry(content);

  return createAnalyzedChangelogEntry({
    content: entry.content,
    prefix: entry.prefix,
    relatedDocs: [
      {
        file,
        snippets: [file.replace(/^docs\//, '').replace(/\.md$/, '')],
        hitCount: 1,
      },
    ],
  });
}

function analysis(items: ReturnType<typeof analyzed>[]) {
  return createChangelogAnalysis({
    version: createChangelogVersion('v1.0.0'),
    items,
  });
}
