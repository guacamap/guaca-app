import { beforeAll } from 'vitest';

beforeAll(() => {
  globalThis.fetch = (() => {
    throw new Error('NETWORK CALL IN TEST');
  }) as typeof fetch;
});
