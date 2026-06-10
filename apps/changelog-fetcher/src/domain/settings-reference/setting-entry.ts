import {
  type SettingKey,
  type SettingSource,
  getLeafName,
} from './setting-key';

export type SettingsEntry = {
  key: SettingKey;
  leafName: string;
  source: SettingSource;
  descriptionEn: string;
  parentDescriptions: string[];
};

/**
 * settings schema や env docs から抽出した設定エントリを生成する。
 */
export function createSettingsEntry(input: {
  key: SettingKey;
  source: SettingSource;
  descriptionEn: string;
  parentDescriptions?: string[];
}): SettingsEntry {
  return {
    key: input.key,
    leafName: getLeafName(input.key),
    source: input.source,
    descriptionEn: input.descriptionEn,
    parentDescriptions: input.parentDescriptions ?? [],
  };
}
