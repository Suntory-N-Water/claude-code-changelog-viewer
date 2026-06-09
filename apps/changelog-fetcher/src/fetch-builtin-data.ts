#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getLogger } from '@claude-code-changelog-viewer/common';
import { fetchBuiltinSurface } from './application/fetch-builtin-surface';
import { BuiltinSurfaceFileStore } from './infrastructure/filesystem/builtin-surface-file-store';
import { GithubBuiltinSurfaceClient } from './infrastructure/github/builtin-surface-client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'builtin-data');

const log = getLogger({ name: 'fetch-builtin-data' });

fetchBuiltinSurface({
  source: new GithubBuiltinSurfaceClient(),
  store: new BuiltinSurfaceFileStore(OUTPUT_DIR),
}).catch((error) => {
  log.error('fetch-builtin-data 失敗', { error });
  process.exit(1);
});
