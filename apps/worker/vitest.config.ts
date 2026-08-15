import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'changelog-viewer-worker',
    env: { AGENT: '1' },
  },
});
