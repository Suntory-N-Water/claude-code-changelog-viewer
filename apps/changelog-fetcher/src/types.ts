export type Pipeline = 'developer' | 'extension' | 'general';
export type SearchStrategy = 'exact' | 'normalized' | 'multi' | 'skip';
export type AnalysisStatus =
  | 'ready_for_inference'
  | 'docs_pending'
  | 'sdk_only'
  | 'no_docs_found';

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
