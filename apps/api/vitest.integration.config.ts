import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'api-integration',
    include: ['test/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30000,
    setupFiles: ['../../test/setup.ts'],
  },
});
