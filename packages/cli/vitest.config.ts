import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cli-unit',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
  },
});
