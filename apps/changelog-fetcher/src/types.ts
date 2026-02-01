export type Keywords = { original: string[]; normalized: string[] };

export type ParsedItem = {
  content: string;
  prefix: string;
  tags: string[];
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
