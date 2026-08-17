/** 設定キーと発生元から settings_reference 用の slug を生成する。 */
export function createSettingSlugFromKey(
  key: string,
  source: 'settings' | 'env',
): string {
  if (source === 'env') {
    return key.toLowerCase().replace(/_/g, '-');
  }

  return key
    .split('.')
    .map((value) =>
      value
        .replace(/([A-Z])/g, '-$1')
        .toLowerCase()
        .replace(/_/g, '-')
        .replace(/^-/, ''),
    )
    .join('-');
}
