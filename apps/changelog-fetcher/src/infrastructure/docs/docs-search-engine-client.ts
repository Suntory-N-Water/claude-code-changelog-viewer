import { spawn } from 'node:child_process';
import * as path from 'node:path';
import { PROJECT_ROOT } from './docs-paths';

export const DOCS_SEARCH_ENGINE_DIR = path.join(
  PROJECT_ROOT,
  'apps',
  'docs-search-engine',
);
export const DOCS_DIR = path.join(
  PROJECT_ROOT,
  'apps',
  'docs-tracker',
  'docs',
  'en',
);

export type PythonRelatedDoc = {
  file: string;
  snippets: string[];
  snippetScores: number[];
  hitCount: number;
};

export type PythonSearchOutput = {
  results: PythonRelatedDoc[][];
};

export function runDocsSearchEngine(payload: {
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
