/**
 * 機能領域タグの slug ↔ label マッピング
 *
 * changelog-fetcher 側の FEATURE_AREA_RULES と一致させる
 */

const FEATURE_AREAS: { slug: string; label: string }[] = [
  { slug: 'ide-vscode', label: 'IDE/VSCode' },
  { slug: 'hooks', label: 'Hooks' },
  { slug: 'mcp', label: 'MCP' },
  { slug: 'skills', label: 'Skills' },
  { slug: 'agent-teams', label: 'Agent Teams' },
  { slug: 'sub-agents', label: 'Sub-agents' },
  { slug: 'plan', label: 'Plan' },
  { slug: 'plugins', label: 'Plugins' },
  { slug: 'settings', label: 'Settings' },
  { slug: 'memory', label: 'Memory' },
  { slug: 'permissions', label: 'Permissions' },
  { slug: 'cli-core', label: '' },
];

export function getAllAreas(): { slug: string; label: string }[] {
  return FEATURE_AREAS;
}

export function slugify(label: string): string {
  return label.toLowerCase().replace(/\//g, '-').replace(/\s+/g, '-');
}

export function labelFor(slug: string): string | undefined {
  return FEATURE_AREAS.find((a) => a.slug === slug)?.label;
}
