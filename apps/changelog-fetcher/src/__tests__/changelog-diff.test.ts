import { afterAll, describe, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { ChangelogDiff, DiffEvent } from '../types';
import {
  extractItems,
  isDuplicateEvent,
  loadDiffFile,
  saveDiffFile,
} from '../parse-changelog';

const tmpDir = mkdtempSync(join(tmpdir(), 'changelog-diff-test-'));

afterAll(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

describe('extractItems', () => {
  test('「- 」で始まる行のみを抽出する', () => {
    const content = '## 2.1.66\n\n- Item A\n- Item B\nNot an item\n';
    expect(extractItems(content)).toEqual(['- Item A', '- Item B']);
  });

  test('空文字列は空配列を返す', () => {
    expect(extractItems('')).toEqual([]);
  });

  test('項目がない場合は空配列を返す', () => {
    const content = '## 2.1.66\n\nSome text without items\n';
    expect(extractItems(content)).toEqual([]);
  });

  test('前後の空白を trim してから判定する', () => {
    const content = '  - Indented item\n';
    expect(extractItems(content)).toEqual(['- Indented item']);
  });
});

describe('isDuplicateEvent', () => {
  const baseEvent: Pick<
    DiffEvent,
    'version' | 'type' | 'items_added' | 'items_removed'
  > = {
    version: 'v1.0.0',
    type: 'items_changed',
    items_added: ['- New item'],
    items_removed: ['- Old item'],
  };

  const existingEvents: DiffEvent[] = [
    {
      detected_at: '2026-03-04T00:00:00.000Z',
      ...baseEvent,
    },
  ];

  test('同一 version・type・items で true を返す', () => {
    expect(isDuplicateEvent(existingEvents, baseEvent)).toBe(true);
  });

  test('version が異なれば false を返す', () => {
    expect(
      isDuplicateEvent(existingEvents, { ...baseEvent, version: 'v2.0.0' }),
    ).toBe(false);
  });

  test('items_added が異なれば false を返す', () => {
    expect(
      isDuplicateEvent(existingEvents, {
        ...baseEvent,
        items_added: ['- Different item'],
      }),
    ).toBe(false);
  });

  test('空の events 配列には false を返す', () => {
    expect(isDuplicateEvent([], baseEvent)).toBe(false);
  });
});

describe('loadDiffFile / saveDiffFile', () => {
  test('ファイルが存在しない場合に空の events 配列を返す', () => {
    const nonExistent = join(tmpDir, 'nonexistent', 'diff.json');
    const result = loadDiffFile(nonExistent);
    expect(result).toEqual({ events: [] });
  });

  test('既存ファイルを正しく読み込む', async () => {
    const filePath = join(tmpDir, 'load-test', 'diff.json');
    const data: ChangelogDiff = {
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
    await Bun.write(filePath, JSON.stringify(data, null, 2));

    const result = loadDiffFile(filePath);
    expect(result).toEqual(data);
  });

  test('ディレクトリが存在しない場合に自動作成する', async () => {
    const filePath = join(tmpDir, 'auto-create', 'nested', 'diff.json');
    const data: ChangelogDiff = { events: [] };

    saveDiffFile(filePath, data);

    const file = Bun.file(filePath);
    expect(await file.exists()).toBe(true);
    expect(await file.json()).toEqual(data);
  });
});

function computeItemDiff(local: string, remote: string) {
  const localItems = extractItems(local);
  const remoteItems = extractItems(remote);
  const localSet = new Set(localItems);
  const remoteSet = new Set(remoteItems);
  return {
    added: remoteItems.filter((item) => !localSet.has(item)),
    removed: localItems.filter((item) => !remoteSet.has(item)),
  };
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
  test('イベントを追記して保存できる', () => {
    const filePath = join(tmpDir, 'append-test', 'diff.json');
    const initial: ChangelogDiff = {
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

    saveDiffFile(filePath, initial);

    const loaded = loadDiffFile(filePath);
    loaded.events.push({
      detected_at: '2026-03-04T01:00:00.000Z',
      version: 'v1.0.1',
      type: 'version_removed',
      items_added: [],
      items_removed: [],
    });
    saveDiffFile(filePath, loaded);

    const result = loadDiffFile(filePath);
    expect(result.events).toHaveLength(2);
    expect(result.events[0]?.version).toBe('v1.0.0');
    expect(result.events[1]?.version).toBe('v1.0.1');
    expect(result.events[1]?.type).toBe('version_removed');
  });

  test('重複イベントはスキップされる', () => {
    const events: DiffEvent[] = [
      {
        detected_at: '2026-03-04T00:00:00.000Z',
        version: 'v1.0.0',
        type: 'items_changed',
        items_added: ['- X'],
        items_removed: [],
      },
    ];
    const candidate = {
      version: 'v1.0.0',
      type: 'items_changed' as const,
      items_added: ['- X'],
      items_removed: [] as string[],
    };

    if (!isDuplicateEvent(events, candidate)) {
      events.push({ detected_at: new Date().toISOString(), ...candidate });
    }

    expect(events).toHaveLength(1);
  });
});
