#!/usr/bin/env node

import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { SchemaFetcher } from './lib/schema-fetcher';

const logger = getLogger({ name: 'docs-tracker' });

async function main() {
  logger.msg('APLG0001', {
    attrs: { arg0: 'Claude Code Settings Schema Fetcher' },
  });

  const startTime = Date.now();

  try {
    const fetcher = new SchemaFetcher(process.cwd());
    await fetcher.fetchSchema();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.msg('APLG0002', {
      attrs: { arg0: '処理', 'elapsed.seconds': elapsed },
    });

    process.exit(0);
  } catch (error) {
    logger.msg('APLG0018', { error: toError(error) });
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch((error) => {
    logger.msg('APLG0019', { error: toError(error) });
    process.exit(1);
  });
}

export { main };
