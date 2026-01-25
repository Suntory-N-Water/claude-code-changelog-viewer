export { main as fetchDocs } from './fetch-docs';
export { ClaudeDocsFetcher } from './lib/doc-fetcher';

// Re-export for convenience
import { ClaudeDocsFetcher } from './lib/doc-fetcher';

/**
 * Default export for easy importing
 */
export default ClaudeDocsFetcher;
