import type { ChangelogEntry } from './changelog-entry';
import type { ChangelogVersion } from './changelog-version';

export type ChangelogRelease = {
  version: ChangelogVersion;
  content: string;
  entries: ChangelogEntry[];
};

export type CreateChangelogReleaseInput = {
  version: ChangelogVersion;
  content: string;
  entries: ChangelogEntry[];
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
