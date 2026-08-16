import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

const workerDirectory = dirname(fileURLToPath(import.meta.url));
const notificationMigrations = await readD1Migrations(
  resolve(workerDirectory, 'drizzle/migrations'),
);
const docsSearchMigrations = await readD1Migrations(
  resolve(workerDirectory, 'docs-search/migrations'),
);

export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: {
        configPath: resolve(workerDirectory, 'wrangler.jsonc'),
      },
      miniflare: {
        bindings: {
          CF_ACCESS_AUD: 'test-access-aud',
          CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
          D1_REST_API_TOKEN: 'test-d1-rest-api-token',
          DEPLOY_HOOK_URL: 'https://deploy.example/hook',
          DISPATCH_SECRET: 'test-dispatch-secret',
          EMAIL_ENCRYPTION_KEY: 'test-email-encryption-key',
          GITHUB_DISPATCH_TOKEN: 'test-github-token',
          TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
          TEST_NOTIFICATION_MIGRATIONS: notificationMigrations,
          TEST_DOCS_SEARCH_MIGRATIONS: docsSearchMigrations,
        },
      },
    }),
  ],
  test: {
    clearMocks: true,
    include: [resolve(workerDirectory, 'src/workflows/*.integration.test.ts')],
    name: 'changelog-viewer-worker-workflow',
    restoreMocks: true,
  },
});
