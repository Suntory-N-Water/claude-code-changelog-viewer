/**
 * feature_areas 別集約ページのユーティリティ
 *
 * スラッグ変換・ラベル・説明文・データ集約・衝突検出を提供。
 * features/index.astro / features/[area].astro / ChangelogItemCard で共通利用
 */

import type { ChangelogItem } from '@claude-code-changelog-viewer/types';

/** ページ生成に必要な最小アイテム数(これ未満のエリアはページを生成しない) */
export const MIN_ITEMS_FOR_PAGE = 3;

/** 決定的な変換: lowercase + スラッシュ/スペース → ハイフン */
export function toFeatureAreaSlug(area: string): string {
  return area.toLowerCase().replace(/[/\s]+/g, '-');
}

/** スラッグから元の feature_area 名を逆引き */
export function findAreaBySlug(
  slug: string,
  allAreas: string[],
): string | undefined {
  return allAreas.find((area) => toFeatureAreaSlug(area) === slug);
}

/** 表示ラベル(公式名称をそのまま使用) */
export const FEATURE_AREA_LABELS: Record<string, string> = {
  Settings: 'Settings',
  'IDE/VSCode': 'IDE / VSCode',
  Memory: 'Memory',
  Skills: 'Skills',
  Permissions: 'Permissions',
  MCP: 'MCP',
  Hooks: 'Hooks',
  Plugins: 'Plugins',
  'Sub-agents': 'Sub-agents',
  'Agent Teams': 'Agent Teams',
  Plan: 'Plan',
  SDK: 'SDK',
  Tasks: 'Tasks',
  CLI: 'CLI',
};

/** SEO description */
const FEATURE_AREA_DESCRIPTIONS: Record<string, string> = {
  Settings:
    'Claude CodeのSettingsに関する全バージョンの変更履歴。CLAUDE.md、.clauderc、環境変数などの設定変更をバージョン横断で確認できます。',
  'IDE/VSCode':
    'Claude CodeのIDE/VSCode連携に関する全バージョンの変更履歴。エディタ統合、拡張機能、ワークスペース対応の変更をバージョン横断で確認できます。',
  Memory:
    'Claude CodeのMemory機能に関する全バージョンの変更履歴。コンテキスト管理、会話履歴、自動記憶の変更をバージョン横断で確認できます。',
  Skills:
    'Claude CodeのSkills機能に関する全バージョンの変更履歴。カスタムスキル、スラッシュコマンド、スキル管理の変更をバージョン横断で確認できます。',
  Permissions:
    'Claude CodeのPermissions機能に関する全バージョンの変更履歴。ツール許可、セキュリティ設定、承認フローの変更をバージョン横断で確認できます。',
  MCP: 'Claude CodeのMCP(Model Context Protocol)に関する全バージョンの変更履歴。MCPサーバー、ツール統合、プロトコル対応の変更をバージョン横断で確認できます。',
  Hooks:
    'Claude CodeのHooks機能に関する全バージョンの変更履歴。カスタムフック、イベントトリガー、自動化の変更をバージョン横断で確認できます。',
  Plugins:
    'Claude CodeのPlugins機能に関する全バージョンの変更履歴。プラグイン管理、サードパーティ統合の変更をバージョン横断で確認できます。',
  'Sub-agents':
    'Claude CodeのSub-agents機能に関する全バージョンの変更履歴。並列処理、タスク委譲、エージェント制御の変更をバージョン横断で確認できます。',
  'Agent Teams':
    'Claude CodeのAgent Teams機能に関する全バージョンの変更履歴。マルチエージェント連携、チーム設定の変更をバージョン横断で確認できます。',
  Plan: 'Claude CodeのPlan機能に関する全バージョンの変更履歴。計画立案、タスク分解、実行戦略の変更をバージョン横断で確認できます。',
};

/** ラベル取得(未知エリアはエリア名をそのまま返す) */
export function getFeatureAreaLabel(area: string): string {
  return FEATURE_AREA_LABELS[area] ?? area;
}

/** SEO description 取得(未知エリアはテンプレート生成) */
export function getFeatureAreaDescription(area: string): string {
  return (
    FEATURE_AREA_DESCRIPTIONS[area] ??
    `Claude Codeの${area}に関する全バージョンの変更履歴`
  );
}

export type FeatureAreaItem = { version: string; item: ChangelogItem };
export type VersionGroup = { version: string; items: ChangelogItem[] };

/** 全 changelog から feature_area 別にアイテムを集約 */
export function aggregateByFeatureArea(
  changelogs: { version: string; items: ChangelogItem[] }[],
): Map<string, FeatureAreaItem[]> {
  const map = new Map<string, FeatureAreaItem[]>();

  for (const { version, items } of changelogs) {
    for (const item of items) {
      const areas = item.feature_areas;
      if (!areas || areas.length === 0) {
        continue;
      }

      for (const area of areas) {
        const existing = map.get(area);
        if (existing) {
          existing.push({ version, item });
        } else {
          map.set(area, [{ version, item }]);
        }
      }
    }
  }

  return map;
}

/** バージョン降順 → グループ内 importance_score 降順にソート */
export function groupByVersion(
  items: FeatureAreaItem[],
  compareFn: (a: string, b: string) => number,
): VersionGroup[] {
  const groupMap = new Map<string, ChangelogItem[]>();

  for (const { version, item } of items) {
    const existing = groupMap.get(version);
    if (existing) {
      existing.push(item);
    } else {
      groupMap.set(version, [item]);
    }
  }

  // バージョン降順ソート
  const sorted = [...groupMap.entries()].sort(([a], [b]) => compareFn(a, b));

  // グループ内 importance_score 降順
  return sorted.map(([version, groupItems]) => ({
    version,
    items: groupItems.sort((a, b) => b.importance_score - a.importance_score),
  }));
}

/** ビルド時にスラッグの衝突を検出する。衝突があれば Error を throw */
export function validateSlugUniqueness(areas: string[]): void {
  const slugToAreas = new Map<string, string[]>();

  for (const area of areas) {
    const slug = toFeatureAreaSlug(area);
    const existing = slugToAreas.get(slug);
    if (existing) {
      existing.push(area);
    } else {
      slugToAreas.set(slug, [area]);
    }
  }

  const collisions = [...slugToAreas.entries()].filter(
    ([, names]) => names.length > 1,
  );
  if (collisions.length > 0) {
    const details = collisions
      .map(([slug, names]) => `"${slug}" ← [${names.join(', ')}]`)
      .join('; ');
    throw new Error(`feature_area スラッグが衝突しています: ${details}`);
  }
}
