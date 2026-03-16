export const PREFIX_ORDER = [
  'Breaking',
  'Added',
  'Deprecated',
  'Changed',
  'Improved',
  'Updated',
  'Removed',
  'Fixed',
  'Enabled',
] as const;

export type Prefix = (typeof PREFIX_ORDER)[number];

/** ソート用ヘルパー: PREFIX_ORDER のインデックスを返す(未定義は末尾) */
export function getPrefixSortOrder(prefix: string): number {
  const idx = PREFIX_ORDER.indexOf(prefix as Prefix);
  return idx === -1 ? PREFIX_ORDER.length : idx;
}
