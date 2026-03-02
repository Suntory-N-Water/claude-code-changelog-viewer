import { describe, expect, test } from 'bun:test';
import type { ChangelogItem } from '@claude-code-changelog-viewer/types';
import {
  aggregateByFeatureArea,
  findAreaBySlug,
  groupByVersion,
  toFeatureAreaSlug,
  validateSlugUniqueness,
} from '../feature-area';

// 実データの全14エリア
const ALL_AREAS = [
  'Settings',
  'IDE/VSCode',
  'Memory',
  'Skills',
  'Permissions',
  'MCP',
  'Hooks',
  'Plugins',
  'Sub-agents',
  'Agent Teams',
  'Plan',
  'SDK',
  'Tasks',
  'CLI',
];

function makeItem(overrides: Partial<ChangelogItem> = {}): ChangelogItem {
  return {
    content: 'test content',
    prefix: 'Added',
    importance_score: 5,
    related_docs: [],
    ...overrides,
  };
}

describe('toFeatureAreaSlug', () => {
  test('スラッシュをハイフンに変換する', () => {
    expect(toFeatureAreaSlug('IDE/VSCode')).toBe('ide-vscode');
  });

  test('既存ハイフンを保持する', () => {
    expect(toFeatureAreaSlug('Sub-agents')).toBe('sub-agents');
  });

  test('スペースをハイフンに変換する', () => {
    expect(toFeatureAreaSlug('Agent Teams')).toBe('agent-teams');
  });

  test('単純な小文字化', () => {
    expect(toFeatureAreaSlug('MCP')).toBe('mcp');
    expect(toFeatureAreaSlug('Settings')).toBe('settings');
  });

  test('全14エリアで一意なスラッグが生成される', () => {
    const slugs = ALL_AREAS.map(toFeatureAreaSlug);
    expect(new Set(slugs).size).toBe(ALL_AREAS.length);
  });
});

describe('findAreaBySlug', () => {
  test('全14エリアについて往復整合性が成立する', () => {
    for (const area of ALL_AREAS) {
      const slug = toFeatureAreaSlug(area);
      expect(findAreaBySlug(slug, ALL_AREAS)).toBe(area);
    }
  });

  test('存在しないスラッグは undefined を返す', () => {
    expect(findAreaBySlug('unknown', ALL_AREAS)).toBeUndefined();
  });
});

describe('aggregateByFeatureArea', () => {
  test('複数エリアに属するアイテムは両方に出現する', () => {
    const changelogs = [
      {
        version: '2.1.0',
        items: [makeItem({ feature_areas: ['MCP', 'Hooks'] })],
      },
    ];

    const result = aggregateByFeatureArea(changelogs);
    expect(result.get('MCP')?.length).toBe(1);
    expect(result.get('Hooks')?.length).toBe(1);
  });

  test('feature_areas が空配列のアイテムはどのエリアにも含まれない', () => {
    const changelogs = [
      {
        version: '2.1.0',
        items: [makeItem({ feature_areas: [] })],
      },
    ];

    const result = aggregateByFeatureArea(changelogs);
    expect(result.size).toBe(0);
  });

  test('feature_areas が未設定のアイテムはどのエリアにも含まれない', () => {
    const changelogs = [
      {
        version: '2.1.0',
        items: [makeItem({ feature_areas: undefined })],
      },
    ];

    const result = aggregateByFeatureArea(changelogs);
    expect(result.size).toBe(0);
  });

  test('2つのバージョンの同じエリアのアイテムが正しく合算される', () => {
    const changelogs = [
      {
        version: '2.1.0',
        items: [makeItem({ feature_areas: ['MCP'] })],
      },
      {
        version: '2.0.0',
        items: [
          makeItem({ feature_areas: ['MCP'] }),
          makeItem({ feature_areas: ['MCP'] }),
        ],
      },
    ];

    const result = aggregateByFeatureArea(changelogs);
    expect(result.get('MCP')?.length).toBe(3);
  });
});

describe('groupByVersion', () => {
  // semverCompareDesc と同じ比較関数
  const compareFn = (a: string, b: string): number => {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const diff = (pb.at(i) ?? 0) - (pa.at(i) ?? 0);
      if (diff !== 0) {
        return diff;
      }
    }
    return 0;
  };

  test('バージョン降順でグループが並ぶ', () => {
    const items = [
      { version: '2.0.0', item: makeItem() },
      { version: '2.1.63', item: makeItem() },
      { version: '2.1.60', item: makeItem() },
    ];

    const groups = groupByVersion(items, compareFn);
    expect(groups.map((g) => g.version)).toEqual(['2.1.63', '2.1.60', '2.0.0']);
  });

  test('同一バージョン内のアイテムが importance_score 降順で並ぶ', () => {
    const items = [
      { version: '2.1.0', item: makeItem({ importance_score: 3 }) },
      { version: '2.1.0', item: makeItem({ importance_score: 8 }) },
      { version: '2.1.0', item: makeItem({ importance_score: 5 }) },
    ];

    const groups = groupByVersion(items, compareFn);
    expect(groups[0].items.map((i) => i.importance_score)).toEqual([8, 5, 3]);
  });
});

describe('validateSlugUniqueness', () => {
  test('全エリアが一意のスラッグを持つ場合、エラーを throw しない', () => {
    expect(() => validateSlugUniqueness(ALL_AREAS)).not.toThrow();
  });

  test('同じスラッグになる入力で Error を throw する', () => {
    expect(() => validateSlugUniqueness(['VS Code', 'VS/Code'])).toThrow(
      /スラッグが衝突/,
    );
  });
});
