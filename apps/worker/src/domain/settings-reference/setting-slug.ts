/** 設定キーと発生元から settings_reference 用の slug を生成する。 */
export function createSettingSlugFromKey(
  key: string,
  source: 'settings' | 'env',
): string {
  if (source === 'env') {
    return key.toLowerCase().replace(/_/g, '-');
  }

  return key.split('.').map(toKebabCase).join('-');
}

type SettingSlugCandidate = {
  key: string;
  source: 'settings' | 'env';
};

/**
 * 全キーを見て slug を一意にする。
 *
 * `voiceEnabled` と `voice.enabled` のように camelCase の区切りとドットが同じハイフンに潰れると
 * 同じ slug になり、片方のページへ到達できなくなる。衝突したキーだけドットを `--` として残す。
 * 既存の slug を保つため、衝突していないキーには手を入れない。
 */
export function resolveSettingSlugs(
  candidates: readonly SettingSlugCandidate[],
): Map<string, string> {
  const keysByBaseSlug = new Map<string, string[]>();
  for (const { key, source } of candidates) {
    const baseSlug = createSettingSlugFromKey(key, source);
    keysByBaseSlug.set(baseSlug, [
      ...(keysByBaseSlug.get(baseSlug) ?? []),
      key,
    ]);
  }

  const slugs = new Map<string, string>();
  const usedSlugs = new Set<string>();
  for (const { key, source } of candidates) {
    const baseSlug = createSettingSlugFromKey(key, source);
    const hasConflict = (keysByBaseSlug.get(baseSlug)?.length ?? 0) > 1;
    const slug =
      hasConflict && key.includes('.')
        ? key.split('.').map(toKebabCase).join('--')
        : baseSlug;

    let uniqueSlug = slug;
    for (let suffix = 2; usedSlugs.has(uniqueSlug); suffix += 1) {
      uniqueSlug = `${slug}-${suffix}`;
    }
    usedSlugs.add(uniqueSlug);
    slugs.set(key, uniqueSlug);
  }

  return slugs;
}

function toKebabCase(value: string): string {
  return value
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/_/g, '-')
    .replace(/^-/, '');
}
