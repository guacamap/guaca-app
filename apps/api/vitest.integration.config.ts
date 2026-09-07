import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-integration',
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    setupFiles: ['../../test/setup.ts'],
    // Each file creates or migrates its own database. Parallel
    // drop schema / postgis setup spikes Postgres shared memory.
    fileParallelism: false,
  },
});
