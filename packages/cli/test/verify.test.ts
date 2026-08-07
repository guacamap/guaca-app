import { describe, expect, it } from 'vitest';
import { queueCommand, verifyCommand } from '../src/commands/verify.ts';

describe('T6.2 — guaca queue / verify', () => {
  it('queue lists pending operator items', async () => {
    const items = await queueCommand(
      {
        pendingOperatorQueue: async () => [
          { id: 'r1', placeId: 'p1', decision: 'needs_operator', checks: {}, createdAt: new Date(), placeName: 'Arepera' },
        ],
        operatorVerify: async () => ({ ok: true }),
      },
      {} as never,
    );
    expect(items).toHaveLength(1);
    expect(items[0]!.placeName).toBe('Arepera');
  });

  it('verify --approve flips the run and returns the audit trail', async () => {
    const audit: string[] = [];
    const result = await verifyCommand({
      id: 'r1',
      action: 'APPROVE',
      operator: 'ops-lead',
      reason: 'looks real',
      db: {
        pendingOperatorQueue: async () => [],
        operatorVerify: async (runId, decision, operator, note) => {
          audit.push(`${runId}:${decision}:${operator}:${note}`);
          return { ok: true };
        },
      },
    });
    expect(result.ok).toBe(true);
    expect(audit).toEqual(['r1:APPROVE:ops-lead:looks real']);
  });

  it('verify on a missing run reports not-found', async () => {
    const result = await verifyCommand({
      id: 'missing',
      action: 'REJECT',
      operator: 'ops-lead',
      reason: 'fake',
      db: {
        pendingOperatorQueue: async () => [],
        operatorVerify: async () => ({ ok: false, reason: 'not found' }),
      },
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('not found');
  });
});
