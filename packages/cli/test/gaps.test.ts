import { describe, expect, it } from 'vitest';
import { gapsCommand, commissionCommand } from '../src/commands/gaps.ts';

describe('T6.3 — guaca gaps / commission', () => {
  it('gaps lists ranked open gaps with score breakdown', async () => {
    const db = {
      rankedGaps: async () => [
        { id: 'g1', category: 'eat_drink', h3_8: 'h', questionCount: 7, distinctSessionCount: 6, score: 219, status: 'open' },
      ],
      operatorCommission: async () => ({ status: 'offered' as const, missionId: 'm1' }),
    };
    const items = await gapsCommand(db, {} as never, undefined);
    expect(items).toHaveLength(1);
    expect(items[0]!.score).toBe(219);
  });

  it('commission --approve creates an operator mission', async () => {
    const result = await commissionCommand({
      gapId: 'g1',
      spotterId: 's1',
      rewardMinor: 300,
      approve: true,
      db: {
        rankedGaps: async () => [],
        operatorCommission: async (input) => ({ status: 'offered' as const, missionId: 'm1' }),
      },
      pool: {} as never,
    });
    expect(result.status).toBe('offered');
    expect(result.missionId).toBe('m1');
  });

  it('commission without --approve is refused (operator must confirm)', async () => {
    const result = await commissionCommand({
      gapId: 'g1',
      spotterId: 's1',
      rewardMinor: 300,
      approve: false,
      db: {
        rankedGaps: async () => [],
        operatorCommission: async () => ({ status: 'offered' as const, missionId: 'm1' }),
      },
      pool: {} as never,
    });
    expect(result.status).toBe('blocked');
    expect(result.reason).toMatch(/approve/i);
  });
});
