/**
 * CHANGELOG 項目に機能領域タグを自動付与するルールベースタガー
 */

type FeatureAreaRule = {
  pattern: RegExp;
  tag: string;
};

const FEATURE_AREA_RULES: FeatureAreaRule[] = [
  { pattern: /\bVSCode\b/i, tag: 'IDE/VSCode' },
  { pattern: /\bhooks?\b/i, tag: 'Hooks' },
  { pattern: /\bMCP\b|Model Context Protocol/, tag: 'MCP' },
  { pattern: /\bskills?\b/i, tag: 'Skills' },
  { pattern: /\bagent teams?\b|teammates?\b/i, tag: 'Agent Teams' },
  { pattern: /\bsub-?agents?\b/i, tag: 'Sub-agents' },
  { pattern: /\bplan mode\b/i, tag: 'Plan' },
  { pattern: /\bplugins?\b/i, tag: 'Plugins' },
  { pattern: /\bsettings?\b/i, tag: 'Settings' },
  { pattern: /\bmemory\b|CLAUDE\.md/i, tag: 'Memory' },
  { pattern: /\bpermissions?\b/i, tag: 'Permissions' },
];

/**
 * content に対して全ルールをマッチし、ヒットしたタグの配列を返す。
 * 何もマッチしなければ空配列を返す。
 */
export function tagFeatureAreas(content: string): string[] {
  const matched = FEATURE_AREA_RULES.filter((rule) =>
    rule.pattern.test(content),
  ).map((rule) => rule.tag);

  return matched.length > 0 ? matched : [];
}
