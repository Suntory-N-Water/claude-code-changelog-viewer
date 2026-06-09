import type { InferenceResult } from '../inference/inference-result';
import type { SettingKey, SettingSource } from './setting-key';
import { type SettingSlug, createSettingSlugFromKey } from './setting-slug';
import type { SettingsEntry } from './setting-entry';

export type RelatedChangelog = {
  version: string;
  content: string;
  contentJa?: string;
  inference?: InferenceResult;
};

export type SettingReference = {
  key: SettingKey;
  leafName: string;
  slug: SettingSlug;
  source: SettingSource;
  descriptionEn: string;
  descriptionJa: string;
  useCaseJa?: string;
  parentDescriptions: string[];
  docSnippets: string[];
  relatedChangelog: RelatedChangelog[];
};

/**
 * 設定エントリと翻訳・関連情報から出力用リファレンスを組み立てる。
 */
export function createSettingReference(input: {
  entry: SettingsEntry;
  descriptionJa: string;
  useCaseJa?: string;
  docSnippets?: string[];
  relatedChangelog?: RelatedChangelog[];
}): SettingReference {
  return {
    key: input.entry.key,
    leafName: input.entry.leafName,
    slug: createSettingSlugFromKey(input.entry.key, input.entry.source),
    source: input.entry.source,
    descriptionEn: input.entry.descriptionEn,
    descriptionJa: input.descriptionJa,
    ...(input.useCaseJa ? { useCaseJa: input.useCaseJa } : {}),
    parentDescriptions: input.entry.parentDescriptions,
    docSnippets: input.docSnippets ?? [],
    relatedChangelog: input.relatedChangelog ?? [],
  };
}
