export type Keywords = { original: string[]; normalized: string[] };

export type ParsedItem = {
  content: string;
  prefix: string;
  tags: string[];
  // schema 互換のため残す固定値。現在は意味のある評価値として使わない。
  importance_score: number;
};

export type SearchResult = {
  files: string[];
};

export type SnippetResult = {
  file: string;
  snippets: string[];
  hit_count: number;
};

export type DiffEventType = 'items_changed' | 'version_removed';

export type DiffEvent = {
  detected_at: string;
  version: string;
  type: DiffEventType;
  items_added: string[];
  items_removed: string[];
};

export type ChangelogDiff = {
  events: DiffEvent[];
};
