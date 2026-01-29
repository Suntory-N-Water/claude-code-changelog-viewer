// changelog-fetcher内部で使用する型定義
export type Pipeline = 'developer' | 'extension' | 'general';
export type SearchStrategy = 'exact' | 'normalized' | 'multi' | 'skip';
export type Keywords = { original: string[]; normalized: string[] };
export type AnalysisStatus =
  | 'ready_for_inference'
  | 'docs_pending'
  | 'sdk_only'
  | 'no_docs_found'
  | 'completed'
  | 'inference_failed';

export type ParsedItem = {
  content: string;
  prefix: string;
  tags: string[];
  pipeline: Pipeline;
  importance_score: number;
};

export type SearchResult = {
  files: string[];
  strategy: SearchStrategy;
};

export type SnippetResult = {
  file: string;
  snippets: string[];
  hit_count: number;
};
