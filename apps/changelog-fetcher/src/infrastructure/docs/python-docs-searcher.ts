import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { normalizeMarkdownForAi } from '@claude-code-changelog-viewer/common';
import type { RelatedDoc } from '../../domain/analysis/related-doc';
import type { DocsSearchPort } from '../../usecase/analyze-changelog';
import { PROJECT_ROOT, toRelativePath } from './docs-paths';

const DOCS_SEARCH_ENGINE_DIR = path.join(
  PROJECT_ROOT,
  'apps',
  'docs-search-engine',
);
const DOCS_DIR = path.join(PROJECT_ROOT, 'apps', 'docs-tracker', 'docs', 'en');

type PythonRelatedDoc = {
  file: string;
  snippets: string[];
  hitCount: number;
};

type PythonSearchOutput = {
  results: PythonRelatedDoc[][];
};

function runDocsSearchEngine(payload: {
  docsDir: string;
  entries: string[];
}): Promise<PythonSearchOutput> {
  return new Promise((resolve, reject) => {
    const child = spawn('uv', ['run', 'python', '-m', 'docs_search_engine'], {
      cwd: DOCS_SEARCH_ENGINE_DIR,
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk;
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `docs_search_engine の実行に失敗しました (code=${code}): ${stderr}`,
          ),
        );
        return;
      }
      resolve(JSON.parse(stdout) as PythonSearchOutput);
    });

    child.stdin.end(JSON.stringify(payload));
  });
}

export const pythonDocsSearcher: DocsSearchPort = {
  findRelatedDocs: async (entries) => {
    if (entries.length === 0) {
      return [];
    }

    const output = await runDocsSearchEngine({
      docsDir: DOCS_DIR,
      entries: entries.map((entry) => entry.content),
    });

    return output.results.map((docs) =>
      docs.map(
        (doc): RelatedDoc => ({
          file: toRelativePath(path.join(DOCS_DIR, doc.file)),
          snippets: doc.snippets
            .map(normalizeMarkdownForAi)
            .filter((snippet) => snippet.length > 0),
          hitCount: doc.hitCount,
        }),
      ),
    );
  },
};
