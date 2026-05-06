/**
 * changelog 検索で誤マッチが多い汎用的な末端名のリスト。
 * これらは leaf_name での検索を無効化し、フルパスのみで検索する。
 *
 * 追加基準: 単語単体では設定を特定できず、changelog に頻出する汎用名詞・動詞。
 */
export const GENERIC_LEAF_NAMES = new Set([
  'allow',
  'deny',
  'ask',
  'type',
  'command',
  'args',
  'mode',
  'verbs',
  'tips',
  'commit',
  'pr',
  'padding',
  'enabled',
  'verbs',
  'environment',
]);

/**
 * changelog 検索に使うキーワード一覧を返す。
 * 末端名が汎用単語の場合はフルパスのみ、それ以外はフルパス + 末端名の両方。
 */
export function buildChangelogSearchTerms(key: string): string[] {
  const leafName = key.split('.').at(-1) ?? key;
  if (leafName === key) {
    return [key];
  }
  if (GENERIC_LEAF_NAMES.has(leafName)) {
    return [key];
  }
  return [key, leafName];
}
