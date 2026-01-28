import type {
  Pipeline,
  SearchStrategy,
} from '@claude-code-changelog-viewer/types';

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
