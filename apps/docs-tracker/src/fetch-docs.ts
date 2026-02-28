#!/usr/bin/env node

import { getLogger, toError } from '@claude-code-changelog-viewer/common';
import { ClaudeDocsFetcher } from './lib/doc-fetcher';

const logger = getLogger({ name: 'docs-tracker' });

/**
 * Main entry point for fetching Claude Code documentation
 */
async function main() {
  logger.msg('APLG0001', { params: ['Claude Code Documentation Tracker'] });

  const startTime = Date.now();

  try {
    // Initialize fetcher with current directory as root
    const fetcher = new ClaudeDocsFetcher(process.cwd(), logger);

    // Fetch all documentation
    await fetcher.fetchAllDocs();

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

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    logger.msg('APLG0019', { error: toError(error) });
    process.exit(1);
  });
}

export { main };
