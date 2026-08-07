import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'shared-unit',
    include: ['test/**/*.test.ts'],
    environment: 'node',
    setupFiles: ['../../test/setup.ts'],
  },
});
