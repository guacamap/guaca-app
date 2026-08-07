import { describe, expect, it } from 'vitest';
import {
  spotterAddCommand,
  spotterListCommand,
  spotterCodeCommand,
} from '../src/commands/spotters.ts';

describe('T6.5 — guaca spotter add|list|code', () => {
  it('add creates a spotter and returns the id', async () => {
    const result = await spotterAddCommand({
      name: 'Yorman',
      phone: '+58 412 000 0001',
      areaId: 'a1',
      db: {
        addSpotter: async () => ({ id: 's1' }),
        listSpotters: async () => [],
        issueLoginCode: async () => 'CODE123',
      },
      pool: {} as never,
    });
    expect(result.id).toBe('s1');
  });

  it('list returns spotters', async () => {
    const rows = await spotterListCommand({
      db: {
        addSpotter: async () => ({ id: 's1' }),
        listSpotters: async () => [
          { id: 's1', name: 'Yorman', phone: '+58 412 000 0001', level: 2, active: true },
        ],
        issueLoginCode: async () => 'CODE123',
      },
      pool: {} as never,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.name).toBe('Yorman');
  });

  it('code issues a one-time login code and stores only its hash', async () => {
    let storedHash = '';
    const result = await spotterCodeCommand({
      spotterId: 's1',
      db: {
        addSpotter: async () => ({ id: 's1' }),
        listSpotters: async () => [],
        issueLoginCode: async (pool, spotterId, hash) => {
          storedHash = hash;
          return 'ignored';
        },
      },
      pool: {} as never,
    });
    // The command returns the freshly minted code it generated.
    expect(result.code).toMatch(/^[0-9A-F]{8}$/);
    // The stored value must be a hash of it, never the plaintext.
    expect(storedHash).not.toBe(result.code);
    expect(storedHash.length).toBe(64);
  });
});
