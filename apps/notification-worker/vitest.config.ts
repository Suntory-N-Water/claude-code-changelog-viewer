import { defineProject } from 'vitest/config';

export default defineProject({
  test: {
    name: 'notification-worker',
    env: { AGENT: '1' },
  },
});
