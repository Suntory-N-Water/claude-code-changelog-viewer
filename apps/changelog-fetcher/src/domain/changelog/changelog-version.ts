declare const changelogVersionBrand: unique symbol;

export type ChangelogVersion = string & {
  readonly [changelogVersionBrand]: unknown;
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
 * ファイル名や JSON 出力で使う `v` なしのバージョン番号を返す。
 */
export function toVersionNumber(version: ChangelogVersion): string {
  return version.replace(/^v/, '');
}

/**
 * changelogs ディレクトリへ保存する Markdown ファイル名を返す。
 */
export function toVersionFilename(version: ChangelogVersion): string {
  return `${version}.md`;
}
