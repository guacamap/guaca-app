import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'db-integration',
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    // Each suite creates its own database; parallel migration spikes Postgres
    // shared memory. Serial is the right model for these heavy suites.
    fileParallelism: false,
  },
});
