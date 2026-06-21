#!/usr/bin/env node

import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { SchemaFetcher } from './lib/schema-fetcher';

const logger = getLogger({ name: 'docs-tracker' });

async function main() {
  logger.msg('APLG0001', { params: ['Claude Code Settings Schema Fetcher'] });

  const startTime = Date.now();

  try {
    const fetcher = new SchemaFetcher(process.cwd());
    await fetcher.fetchSchema();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.msg('APLG0002', {
      params: ['処理'],
      attrs: { 'elapsed.seconds': elapsed },
    });

    process.exit(0);
  } catch (error) {
    logger.msg('APLG0018', { error: toError(error) });
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    logger.msg('APLG0019', { error: toError(error) });
    process.exit(1);
  });
}

export { main };
