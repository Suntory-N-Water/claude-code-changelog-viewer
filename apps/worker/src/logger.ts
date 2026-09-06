import { getLogger } from '@claude-code-changelog-viewer/common';

export const workerLogger = (name: string) =>
  getLogger({
    name,
    serviceName: 'changelog-viewer-worker',
    level: 'INFO',
    format: 'json',
  });
