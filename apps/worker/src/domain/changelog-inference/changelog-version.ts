export function normalizeChangelogVersion(version: string): string {
  return version.replace(/^v/, '');
}

export function formatChangelogVersion(version: string): string {
  return `v${normalizeChangelogVersion(version)}`;
}
