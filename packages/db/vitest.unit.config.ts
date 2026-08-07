import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'db-unit',
    include: ['test/unit/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
  },
});
