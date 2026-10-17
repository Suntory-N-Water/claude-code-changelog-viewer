export function normalizeChangelogVersion(version: string): string {
  return version.replace(/^v/, '');
}

export function formatChangelogVersion(version: string): string {
  return `v${normalizeChangelogVersion(version)}`;
}

// テキスト比較では 2.1.9 > 2.1.10 になるため、数値部ごとに比較する
export function compareChangelogVersions(a: string, b: string): number {
  const partsA = normalizeChangelogVersion(a).split('.').map(Number);
  const partsB = normalizeChangelogVersion(b).split('.').map(Number);
  for (let i = 0; i < Math.max(partsA.length, partsB.length); i += 1) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) {
      return diff;
    }
  }
  return 0;
}

export type ChangelogVersionRange = {
  fromVersion: string;
  toVersion?: string | undefined;
};

export function selectChangelogVersionsInRange(
  versions: string[],
  { fromVersion, toVersion }: ChangelogVersionRange,
): string[] {
  return versions
    .filter(
      (version) =>
        compareChangelogVersions(version, fromVersion) >= 0 &&
        (toVersion === undefined || compareChangelogVersions(version, toVersion) <= 0),
    )
    .sort(compareChangelogVersions);
}
