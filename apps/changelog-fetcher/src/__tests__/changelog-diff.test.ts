import { afterAll, describe, expect, test } from 'vitest';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  computeChangelogEntryDiff,
  isDuplicateDiffEvent,
  type ChangelogDiffEvent,
} from '../domain/changelog/changelog-diff-event';
import { createChangelogVersion } from '../domain/changelog/changelog-version';
import {
  extractChangelogItemLines,
  parseChangelogEntries,
} from '../infrastructure/docs/changelog-markdown-parser';
import {
  loadChangelogDiffFile,
  saveChangelogDiffFile,
  type ChangelogDiffJson,
} from '../infrastructure/filesystem/changelog-file-store';

const tmpDir = mkdtempSync(join(tmpdir(), 'changelog-diff-test-'));

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractChangelogItemLines', () => {
  test('「- 」で始まる行のみを抽出する', () => {
    const content = '## 2.1.66\n\n- Item A\n- Item B\nNot an item\n';
    expect(extractChangelogItemLines(content)).toEqual([
      '- Item A',
      '- Item B',
    ]);
  });

  test('空文字列は空配列を返す', () => {
    expect(extractChangelogItemLines('')).toEqual([]);
  });

  test('項目がない場合は空配列を返す', () => {
    const content = '## 2.1.66\n\nSome text without items\n';
    expect(extractChangelogItemLines(content)).toEqual([]);
  });

  test('「- 」で始まらない行は項目として扱わない', () => {
    const content = '-Item A\n- Item B\n';
    expect(extractChangelogItemLines(content)).toEqual(['- Item B']);
  });

  test('前後の空白を trim してから判定する', () => {
    const content = '  - Indented item\n';
    expect(extractChangelogItemLines(content)).toEqual(['- Indented item']);
  });
});

describe('isDuplicateDiffEvent', () => {
  const baseEvent = {
    version: createChangelogVersion('v1.0.0'),
    type: 'items_changed' as const,
    itemsAdded: ['- New item'],
    itemsRemoved: ['- Old item'],
  };

  const existingEvents: ChangelogDiffEvent[] = [
    {
      detectedAt: new Date('2026-03-04T00:00:00.000Z'),
      ...baseEvent,
    },
  ];

  test('同一 version・type・items で true を返す', () => {
    expect(isDuplicateDiffEvent(existingEvents, baseEvent)).toBe(true);
  });

  test('version が異なれば false を返す', () => {
    expect(
      isDuplicateDiffEvent(existingEvents, {
        ...baseEvent,
        version: createChangelogVersion('v2.0.0'),
      }),
    ).toBe(false);
  });

  test('itemsAdded が異なれば false を返す', () => {
    expect(
      isDuplicateDiffEvent(existingEvents, {
        ...baseEvent,
        itemsAdded: ['- Different item'],
      }),
    ).toBe(false);
  });

  test('itemsRemoved が異なれば false を返す', () => {
    expect(
      isDuplicateDiffEvent(existingEvents, {
        ...baseEvent,
        itemsRemoved: ['- Different item'],
      }),
    ).toBe(false);
  });

  test('items の順序だけが異なる場合も重複とみなす', () => {
    const reorderedExistingEvents: ChangelogDiffEvent[] = [
      {
        detectedAt: new Date('2026-03-04T00:00:00.000Z'),
        version: createChangelogVersion('v1.0.0'),
        type: 'items_changed',
        itemsAdded: ['- New item B', '- New item A'],
        itemsRemoved: ['- Old item B', '- Old item A'],
      },
    ];

    expect(
      isDuplicateDiffEvent(reorderedExistingEvents, {
        version: createChangelogVersion('v1.0.0'),
        type: 'items_changed',
        itemsAdded: ['- New item A', '- New item B'],
        itemsRemoved: ['- Old item A', '- Old item B'],
      }),
    ).toBe(true);
  });

  test('空の events 配列には false を返す', () => {
    expect(isDuplicateDiffEvent([], baseEvent)).toBe(false);
  });
});

describe('loadChangelogDiffFile / saveChangelogDiffFile', () => {
  test('ファイルが存在しない場合に空の events 配列を返す', async () => {
    const nonExistent = join(tmpDir, 'nonexistent', 'diff.json');
    const result = await loadChangelogDiffFile(nonExistent);
    expect(result).toEqual({ events: [] });
  });

  test('既存ファイルを正しく読み込む', async () => {
    const filePath = join(tmpDir, 'load-test', 'diff.json');
    const data: ChangelogDiffJson = {
      events: [
        {
          detected_at: '2026-03-04T00:00:00.000Z',
          version: 'v1.0.0',
          type: 'items_changed',
          items_added: ['- A'],
          items_removed: [],
        },
      ],
    };
    await saveChangelogDiffFile(filePath, data);

    const result = await loadChangelogDiffFile(filePath);
    expect(result).toEqual(data);
  });

  test('ディレクトリが存在しない場合に自動作成する', async () => {
    const filePath = join(tmpDir, 'auto-create', 'nested', 'diff.json');
    const data: ChangelogDiffJson = { events: [] };

    await saveChangelogDiffFile(filePath, data);

    expect(existsSync(filePath)).toBe(true);
    expect(JSON.parse(await fsPromises.readFile(filePath, 'utf8'))).toEqual(
      data,
    );
  });
});

function computeItemDiff(local: string, remote: string) {
  return computeChangelogEntryDiff(
    parseChangelogEntries(local),
    parseChangelogEntries(remote),
  );
}

describe('items_changed 検知', () => {
  test('項目が追加された場合 items_added に記録する', () => {
    const { added, removed } = computeItemDiff(
      '## 1.0.0\n\n- Item A\n',
      '- Item A\n- Item B',
    );
    expect(added).toEqual(['- Item B']);
    expect(removed).toEqual([]);
  });

  test('項目が削除された場合 items_removed に記録する', () => {
    const { added, removed } = computeItemDiff(
      '## 1.0.0\n\n- Item A\n- Item B\n',
      '- Item A',
    );
    expect(added).toEqual([]);
    expect(removed).toEqual(['- Item B']);
  });

  test('項目が入れ替わった場合 両方に記録する', () => {
    const { added, removed } = computeItemDiff(
      '## 1.0.0\n\n- Item A\n- Item B\n',
      '- Item A\n- Item C',
    );
    expect(added).toEqual(['- Item C']);
    expect(removed).toEqual(['- Item B']);
  });

  test('内容が同一の場合 差分なし', () => {
    const { added, removed } = computeItemDiff(
      '## 1.0.0\n\n- Item A\n- Item B\n',
      '- Item A\n- Item B',
    );
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });

  test('順序だけ異なる場合 差分なし', () => {
    const { added, removed } = computeItemDiff(
      '## 1.0.0\n\n- Item A\n- Item B\n',
      '- Item B\n- Item A',
    );
    expect(added).toEqual([]);
    expect(removed).toEqual([]);
  });
});

describe('diff ファイルへの追記', () => {
  test('イベントを追記して保存できる', async () => {
    const filePath = join(tmpDir, 'append-test', 'diff.json');
    const initial: ChangelogDiffJson = {
      events: [
        {
          detected_at: '2026-03-04T00:00:00.000Z',
          version: 'v1.0.0',
          type: 'items_changed',
          items_added: ['- A'],
          items_removed: [],
        },
      ],
    };

    await saveChangelogDiffFile(filePath, initial);

    const loaded = await loadChangelogDiffFile(filePath);
    loaded.events.push({
      detected_at: '2026-03-04T01:00:00.000Z',
      version: 'v1.0.1',
      type: 'version_removed',
      items_added: [],
      items_removed: [],
    });
    await saveChangelogDiffFile(filePath, loaded);

    const result = await loadChangelogDiffFile(filePath);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.version).toBe('v1.0.0');
    expect(result.events[1]?.version).toBe('v1.0.1');
    expect(result.events[1]?.type).toBe('version_removed');
  });

  test('重複イベントはスキップされる', () => {
    const events: ChangelogDiffEvent[] = [
      {
        detectedAt: new Date('2026-03-04T00:00:00.000Z'),
        version: createChangelogVersion('v1.0.0'),
        type: 'items_changed',
        itemsAdded: ['- X'],
        itemsRemoved: [],
      },
    ];
    const candidate = {
      version: createChangelogVersion('v1.0.0'),
      type: 'items_changed' as const,
      itemsAdded: ['- X'],
      itemsRemoved: [] as string[],
    };

    if (!isDuplicateDiffEvent(events, candidate)) {
      events.push({ detectedAt: new Date(), ...candidate });
    }

    expect(events).toHaveLength(1);
  });
});
