import type { SettingKey } from '../domain/settings-reference/setting-key';
import type { SettingSource } from '../domain/settings-reference/setting-key';
import type { SettingSlug } from '../domain/settings-reference/setting-slug';
import type { SettingsEntry } from '../domain/settings-reference/setting-entry';
import type { InferenceResult } from '../domain/inference/inference-result';

export type RelatedChangelogOutput = {
  version: string;
  content: string;
  contentJa?: string;
  inference?: InferenceResult;
};

export type SettingReferenceOutput = {
  key: SettingKey;
  leafName: string;
  slug: SettingSlug;
  source: SettingSource;
  descriptionEn: string;
  descriptionJa: string;
  useCaseJa?: string;
  parentDescriptions: string[];
  docSnippets: string[];
  relatedChangelog: RelatedChangelogOutput[];
  fetchedAt: string;
};

export type SettingsReferenceContext = {
  changelogsMap: Map<SettingKey, RelatedChangelogOutput[]>;
  docSnippetsMap: Map<SettingKey, string[]>;
};

export type SchemaInfo = {
  schemaDefault?: string;
  schemaEnum?: string[];
};

export type SettingsTranslationTarget = {
  id: number;
  entry: SettingsEntry;
  docSnippets: string[];
  relatedChangelog: RelatedChangelogOutput[];
} & SchemaInfo;

export type SettingsTranslation = {
  id: number;
  descriptionJa: string;
  useCaseJa: string;
};

export type SettingsTranslationMap = Map<number, SettingsTranslation>;
