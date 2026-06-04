import type { InferenceResult } from '../inference/inference-result';
import type { SettingKey, SettingSource } from './setting-key';
import { type SettingSlug, createSettingSlugFromKey } from './setting-slug';
import type { SettingsEntry } from './setting-entry';

export type RelatedChangelog = {
  readonly version: string;
  readonly content: string;
  readonly contentJa?: string;
  readonly inference?: InferenceResult;
};

export type SettingReference = {
  readonly key: SettingKey;
  readonly leafName: string;
  readonly slug: SettingSlug;
  readonly source: SettingSource;
  readonly descriptionEn: string;
  readonly descriptionJa: string;
  readonly useCaseJa?: string;
  readonly parentDescriptions: readonly string[];
  readonly docSnippets: readonly string[];
  readonly relatedChangelog: readonly RelatedChangelog[];
};

/**
 * 設定エントリと翻訳・関連情報から出力用リファレンスを組み立てる。
 */
export function createSettingReference(input: {
  readonly entry: SettingsEntry;
  readonly descriptionJa: string;
  readonly useCaseJa?: string;
  readonly docSnippets?: readonly string[];
  readonly relatedChangelog?: readonly RelatedChangelog[];
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
