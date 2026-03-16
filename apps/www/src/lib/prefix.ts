/**
 * CHANGELOG prefix の表示定義(順序・ラベル・スタイル・アイコン)
 *
 * ChangelogItemCard / PrefixTableOfContents / [version].astro で共通利用
 */

import type { Prefix } from '@claude-code-changelog-viewer/common';

export {
  getPrefixSortOrder,
  PREFIX_ORDER,
} from '@claude-code-changelog-viewer/common';
export type { Prefix } from '@claude-code-changelog-viewer/common';

/** 日本語ラベル */
export const PREFIX_LABELS: Record<Prefix, string> = {
  Breaking: '破壊的変更',
  Added: '追加',
  Deprecated: '非推奨',
  Changed: '変更',
  Improved: '改善',
  Updated: '更新',
  Removed: '削除',
  Fixed: '修正',
  Enabled: '有効化',
};

/** Tailwind クラス */
export const PREFIX_STYLES: Record<Prefix, string> = {
  Breaking: 'bg-red-600 text-white shadow-sm',
  Added: 'bg-[hsl(var(--cc-main-orange))] text-white shadow-sm',
  Deprecated: 'border-2 border-yellow-500 text-yellow-700 bg-yellow-50',
  Changed: 'bg-[hsl(var(--cc-main-black))] text-[hsl(var(--cc-main-white))]',
  Improved:
    'border border-[hsl(var(--cc-gray))] text-[hsl(var(--cc-main-black))] bg-[hsl(var(--cc-main-white))]',
  Updated: 'bg-[hsl(var(--cc-main-black))] text-[hsl(var(--cc-main-white))]',
  Removed:
    'border-2 border-[hsl(var(--cc-main-black))] text-[hsl(var(--cc-main-black))] bg-transparent',
  Fixed: 'bg-[hsl(var(--cc-gray))] text-[hsl(var(--cc-main-black))]',
  Enabled: 'bg-green-600 text-white shadow-sm',
};

/** 未定義 prefix 用のフォールバックスタイル */
export const PREFIX_DEFAULT_STYLE =
  'border border-[hsl(var(--cc-gray))] text-[hsl(var(--cc-main-black))] bg-[hsl(var(--cc-main-white))]';

/** SVG パス(stroke アイコン) */
export const PREFIX_ICONS: Record<Prefix, string> = {
  Breaking:
    'M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z',
  Added: 'M12 4.5v15m7.5-7.5h-15',
  Deprecated: 'M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
  Changed:
    'M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5',
  Improved:
    'M2.25 18L9 11.25l4.306 4.306a11.95 11.95 0 015.814-5.518l2.74-1.22m0 0l-5.94-2.281m5.94 2.28l-2.28 5.941',
  Updated: 'M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18',
  Removed: 'M19.5 12h-15',
  Fixed:
    'M11.42 15.17l-4.655-4.655a1 1 0 010-1.414l.354-.354a1 1 0 011.414 0L12 12.21l3.466-3.465a1 1 0 011.414 0l.354.354a1 1 0 010 1.414L12.834 15.17a1 1 0 01-1.414 0z',
  Enabled: 'M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z',
};
