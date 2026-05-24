export type SettingSource = 'settings' | 'env';

export type RawEntry = {
  key: string;
  leaf_name: string;
  source: SettingSource;
  description_en: string;
  parent_descriptions: string[];
};

export type RelatedChangelog = {
  version: string;
  content: string;
  content_ja?: string;
  inference?: {
    before: string;
    after: string;
    benefit: string;
  };
};

export type SettingEntryFile = {
  key: string;
  leaf_name: string;
  slug: string;
  source: SettingSource;
  description_en: string;
  description_ja: string;
  use_case_ja?: string;
  parent_descriptions: string[];
  doc_snippets: string[];
  related_changelog: RelatedChangelog[];
};

export type Translation = {
  description_ja: string;
  use_case_ja: string;
};

export type TranslationMap = Map<number, Translation>;
