import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    pool: 'forks',
    maxWorkers: 3,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
});
