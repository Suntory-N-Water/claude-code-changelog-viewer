declare const settingKeyBrand: unique symbol;

export type SettingKey = string & {
  readonly [settingKeyBrand]: unknown;
};

export type SettingSource = 'settings' | 'env';

/**
 * settings / env の設定キーを空文字でないドメイン値として生成する。
 */
export function createSettingKey(value: string): SettingKey {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    throw new Error('設定キーは空にできません');
  }

  return trimmed as SettingKey;
}

/**
 * ドット区切りの設定キーから末端名を取得する。
 */
export function getLeafName(key: SettingKey): string {
  return key.split('.').at(-1) ?? key;
}
