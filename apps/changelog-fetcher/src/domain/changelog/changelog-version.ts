declare const changelogVersionBrand: unique symbol;

export type ChangelogVersion = string & {
  [changelogVersionBrand]: unknown;
};

const CHANGELOG_VERSION_PATTERN = /^v?\d+\.\d+\.\d+$/;

/**
 * CHANGELOG のバージョン表記を `v` 付きへ正規化する。
 */
export function createChangelogVersion(value: string): ChangelogVersion {
  const trimmed = value.trim();

  if (!CHANGELOG_VERSION_PATTERN.test(trimmed)) {
    throw new Error(`CHANGELOG バージョンの形式が不正です: ${value}`);
  }

  const versionNumber = trimmed.replace(/^v/, '');
  return `v${versionNumber}` as ChangelogVersion;
}

/**
 * 外部向け生成物で使う `v` なしのバージョン番号を返す。
 */
export function toVersionNumber(version: ChangelogVersion): string {
  return version.replace(/^v/, '');
}
