import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'web-unit',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
  },
});
