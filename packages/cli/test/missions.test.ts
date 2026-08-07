import { describe, expect, it } from 'vitest';
import { missionsCommand, overrideCommand, payCommand } from '../src/commands/missions.ts';

describe('T6.4 — guaca missions / override / pay', () => {
  it('missions lists missions, newest first', async () => {
    const db = {
      listMissions: async () => [
        { id: 'm1', gapId: 'g1', spotterId: 's1', brief: 'b', status: 'offered', rewardMinor: 300, currency: 'USD', createdBy: 'agent', offeredAt: new Date(), expiresAt: new Date() },
      ],
      cancelMission: async () => ({ ok: true }),
      payMission: async () => ({ status: 'sent', idempotencyKey: 'm1' }),
    };
    const items = await missionsCommand(db, {} as never, undefined);
    expect(items).toHaveLength(1);
    expect(items[0]!.status).toBe('offered');
  });

  it('override --cancel is audited', async () => {
    const result = await overrideCommand({
      missionId: 'm1',
      cancel: true,
      reason: 'wrong spotter',
      db: {
        listMissions: async () => [],
        cancelMission: async (pool, missionId, operator, reason) => {
          expect(missionId).toBe('m1');
          expect(reason).toBe('wrong spotter');
          return { ok: true };
        },
        payMission: async () => ({ status: 'sent', idempotencyKey: 'm1' }),
      },
      pool: {} as never,
    });
    expect(result.ok).toBe(true);
  });

  it('pay sends through the mock provider with idempotency', async () => {
    const result = await payCommand({
      missionId: 'm1',
      db: {
        listMissions: async () => [
          { id: 'm1', gapId: 'g1', spotterId: 's1', brief: 'b', status: 'verified', rewardMinor: 300, currency: 'USD', createdBy: 'agent', offeredAt: new Date(), expiresAt: new Date() },
        ],
        cancelMission: async () => ({ ok: true }),
        payMission: async (pool, input) => ({ status: 'sent' as const, idempotencyKey: input.missionId }),
      },
      pool: {} as never,
    });
    expect(result.status).toBe('sent');
    expect(result.idempotencyKey).toBe('m1');
  });
});
