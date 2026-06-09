import type { SettingKey } from '../domain/settings-reference/setting-key';
import type { RelatedChangelog } from '../domain/settings-reference/setting-reference';
import type { SettingsEntry } from '../domain/settings-reference/setting-entry';

export type SettingsReferenceContext = {
  changelogsMap: Map<SettingKey, RelatedChangelog[]>;
  docSnippetsMap: Map<SettingKey, string[]>;
};

export type SettingsTranslationTarget = {
  id: number;
  entry: SettingsEntry;
  docSnippets: string[];
  relatedChangelog: RelatedChangelog[];
};

export type SettingsTranslation = {
  id: number;
  descriptionJa: string;
  useCaseJa: string;
};

export type SettingsTranslationMap = Map<number, SettingsTranslation>;
