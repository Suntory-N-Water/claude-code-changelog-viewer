import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    clearMocks: true,
    restoreMocks: true,
    reporters: ['agent'],
    projects: ['apps/*', 'packages/*'],
  },
});
