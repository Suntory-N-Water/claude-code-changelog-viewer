import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'changelog-fetcher',
    env: { AGENT: '1' },
  },
});
