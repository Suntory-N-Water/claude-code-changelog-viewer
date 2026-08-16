import { fileURLToPath } from 'node:url';
import { defineProject } from 'vitest/config';

export default defineProject({
  resolve: {
    alias: {
      'cloudflare:workers': fileURLToPath(
        new URL(
          './src/test-support/cloudflare-workers-stub.ts',
          import.meta.url,
        ),
      ),
      'cloudflare:workflows': fileURLToPath(
        new URL(
          './src/test-support/cloudflare-workflows-stub.ts',
          import.meta.url,
        ),
      ),
    },
  },
  test: {
    exclude: ['src/workflows/*.integration.test.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx,js,jsx}'],
    name: 'changelog-viewer-worker',
    env: { AGENT: '1' },
  },
});
