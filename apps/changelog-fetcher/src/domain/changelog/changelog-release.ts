import type { ChangelogEntry } from './changelog-entry';
import type { ChangelogVersion } from './changelog-version';

export type ChangelogRelease = {
  readonly version: ChangelogVersion;
  readonly content: string;
  readonly entries: readonly ChangelogEntry[];
};

export type CreateChangelogReleaseInput = {
  readonly version: ChangelogVersion;
  readonly content: string;
  readonly entries: readonly ChangelogEntry[];
};

/**
 * 1バージョン分の CHANGELOG 本文と解析済み項目をまとめる。
 */
export function createChangelogRelease(
  input: CreateChangelogReleaseInput,
): ChangelogRelease {
  return {
    version: input.version,
    content: input.content.trim(),
    entries: input.entries,
  };
}
