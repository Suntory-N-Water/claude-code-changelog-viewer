import { globSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  buildChangelogSearchTerms,
  normalizeMarkdownForAi,
} from '@claude-code-changelog-viewer/common';
import { AnalysisSchema } from '@claude-code-changelog-viewer/types';
import type {
  RelatedChangelogOutput,
  SettingsReferenceContext,
} from '../../usecase/settings-translation';
import type { SettingsEntry } from '../../domain/settings-reference/setting-entry';
import { extractSnippets, searchDocs } from '../docs/docs-searcher';

const EXCLUDED_DOC_FILES = new Set(['env-vars.md']);

type FlatChangelogItem = {
  version: string;
  content: string;
  content_ja?: string;
  inference?: {
    before: string;
    after: string;
    benefit: string;
  };
};

export type LoadedSettingsReferenceContext = {
  allInferredCount: number;
  relatedContext: SettingsReferenceContext;
};

/**
 * inferred_v*.json を全件読み込んでフラットな配列に展開
 */
export async function loadAllInferred(
  inferredDir: string,
): Promise<FlatChangelogItem[]> {
  const files = globSync('inferred_v*.json', { cwd: inferredDir })
    .map(String)
    .map((f) => path.join(inferredDir, f));

  const items: FlatChangelogItem[] = [];

  await Promise.all(
    files.map(async (file) => {
      try {
        const raw = await fs.readFile(file, 'utf-8');
        const parsed = AnalysisSchema.parse(JSON.parse(raw));
        for (const item of parsed.items) {
          items.push({
            version: parsed.version,
            content: item.content,
            ...(item.content_ja !== undefined
              ? { content_ja: item.content_ja }
              : {}),
            ...(item.inference !== undefined
              ? { inference: item.inference }
              : {}),
          });
        }
      } catch {
        // パース失敗は無視して続行
      }
    }),
  );

  return items;
}

/**
 * フルパスと末端名の両方で changelog を検索する
 */
function findRelatedChangelogs(
  key: string,
  allItems: FlatChangelogItem[],
): RelatedChangelogOutput[] {
  const searchTerms = buildChangelogSearchTerms(key);
  return allItems
    .filter((item) =>
      searchTerms.some(
        (term) =>
          item.content.includes(term) ||
          (item.content_ja?.includes(term) ?? false),
      ),
    )
    .map((item) => ({
      version: item.version,
      content: item.content,
      ...(item.content_ja !== undefined ? { contentJa: item.content_ja } : {}),
      ...(item.inference !== undefined ? { inference: item.inference } : {}),
    }));
}

/**
 * 末端名をキーワードに docs/en/ を検索してスニペットを取得
 */
async function searchRelatedDocs(leaf_name: string): Promise<string[]> {
  const keywords = { original: [leaf_name], normalized: [leaf_name] };
  const searchResult = await searchDocs(keywords);

  const filteredFiles = searchResult.files.filter(
    (f) => !EXCLUDED_DOC_FILES.has(path.basename(f)),
  );
  if (filteredFiles.length === 0) {
    return [];
  }

  const snippetResults = await extractSnippets(filteredFiles, keywords);
  return snippetResults
    .flatMap((r) => r.snippets)
    .map(normalizeMarkdownForAi)
    .filter((snippet) => snippet.length > 0);
}

export async function collectRelatedContext(
  entries: SettingsEntry[],
  allInferred: FlatChangelogItem[],
): Promise<SettingsReferenceContext> {
  const changelogsMap: SettingsReferenceContext['changelogsMap'] = new Map();
  const docSnippetsMap: SettingsReferenceContext['docSnippetsMap'] = new Map();

  await Promise.all(
    entries.map(async (entry) => {
      changelogsMap.set(
        entry.key,
        findRelatedChangelogs(entry.key, allInferred),
      );
      docSnippetsMap.set(entry.key, await searchRelatedDocs(entry.leafName));
    }),
  );

  return {
    changelogsMap,
    docSnippetsMap,
  };
}

export async function loadSettingsReferenceContext(input: {
  inferredDir: string;
  entries: SettingsEntry[];
}): Promise<LoadedSettingsReferenceContext> {
  const allInferred = await loadAllInferred(input.inferredDir);
  return {
    allInferredCount: allInferred.length,
    relatedContext: await collectRelatedContext(input.entries, allInferred),
  };
}
