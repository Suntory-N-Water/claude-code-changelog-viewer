import type { SettingKey, SettingSource } from './setting-key';

declare const settingSlugBrand: unique symbol;

export type SettingSlug = string & {
  readonly [settingSlugBrand]: unknown;
};

/**
 * settings 出力ファイル名に使える kebab-case slug を生成する。
 */
export function createSettingSlug(value: string): SettingSlug {
  const trimmed = value.trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(trimmed)) {
    throw new Error(`設定 slug の形式が不正です: ${value}`);
  }

  return trimmed as SettingSlug;
}

/**
 * 設定キーと発生元から `settings_*.json` 用の slug を生成する。
 */
export function createSettingSlugFromKey(
  key: SettingKey,
  source: SettingSource,
): SettingSlug {
  if (source === 'env') {
    return createSettingSlug(key.toLowerCase().replace(/_/g, '-'));
  }

  return createSettingSlug(
    key
      .split('.')
      .map((value) =>
        value
          .replace(/([A-Z])/g, '-$1')
          .toLowerCase()
          .replace(/^-/, ''),
      )
      .join('-'),
  );
}
