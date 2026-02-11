#!/usr/bin/env node

import { getLogger } from '@claude-code-changelog-viewer/common';
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
    if (error instanceof Error) {
      logger.msg('APLG0018', { error });
    }
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    if (error instanceof Error) {
      logger.msg('APLG0019', { error });
    } else {
      logger.msg('APLG0019', {
        attrs: { 'error.value': String(error) },
      });
    }
    process.exit(1);
  });
}

export { main };
