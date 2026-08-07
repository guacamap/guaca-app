import { describe, expect, it } from 'vitest';
import {
  VerificationAgent,
  type VerificationInput,
  type VerificationPhoto,
} from '../../src/verification/agent.ts';
import type { Inference, JsonResult, VisionRequest } from '../../src/inference/types.ts';
import type { VisionVerdict } from '../../src/verification/fusion.ts';

const PLACE_ID = '00000000-0000-4000-8000-0000000000d1';
const SPOTTER_ID = '00000000-0000-4000-8000-0000000000c1';
const OTHER_SPOTTER = '00000000-0000-4000-8000-0000000000c2';
const MISSION_ID = '00000000-0000-4000-8000-0000000000m1';

const goodVerdict: VisionVerdict = {
  showsRealPlace: true,
  categoryMatch: true,
  isFranchise: false,
  isScreenshot: false,
  isStockLike: false,
  confidence: 0.9,
  reasons: ['signage_matches'],
};

/** Records every vision request so tests can assert on what the model saw. */
class VisionFake implements Inference {
  calls = 0;
  requests: VisionRequest<unknown>[] = [];
  constructor(private verdict: VisionVerdict = goodVerdict) {}
  async json<T>(): Promise<JsonResult<T>> {
    throw new Error('json not used by the verification agent');
  }
  async vision<T>(req: VisionRequest<T>): Promise<JsonResult<T>> {
    this.calls++;
    this.requests.push(req as VisionRequest<unknown>);
    return {
      raw: this.verdict as T,
      usage: { tokensIn: 100, tokensOut: 20 },
      model: 'fake-vision',
    };
  }
}

function photo(phash: string, body = 'aGVsbG8='): VerificationPhoto {
  return { phash, mimeType: 'image/jpeg', dataBase64: body };
}

const PHOTOS = [
  photo('1111111111111111', 'aW1hZ2Ux'),
  photo('2222222222222222', 'aW1hZ2Uy'),
  photo('3333333333333333', 'aW1hZ2Uz'),
];

function input(overrides: Partial<VerificationInput> = {}): VerificationInput {
  return {
    placeId: PLACE_ID,
    spotterId: SPOTTER_ID,
    mission: {
      missionId: MISSION_ID,
      status: 'accepted',
      assigneeSpotterId: SPOTTER_ID,
      alreadySubmitted: false,
    },
    photos: PHOTOS,
    priorPhashes: [],
    capturedAt: new Date(),
    missionStart: new Date(Date.now() - 3_600_000),
    missionEnd: new Date(Date.now() + 3_600_000),
    pinLat: 10.4716,
    pinLon: -68.0056,
    captureLat: 10.4716,
    captureLon: -68.0056,
    captureAccuracyM: 12,
    spotterConsecutiveAccepted: 0,
    ...overrides,
  };
}

const ctx = () => ({ emit: () => undefined, runId: 'r', loopId: 'l' });

describe('L0 — integrity gate (cheapest rung, runs before everything)', () => {
  it('rejects a submission from someone who is not the mission assignee', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      input({
        mission: {
          missionId: MISSION_ID,
          status: 'accepted',
          assigneeSpotterId: OTHER_SPOTTER,
          alreadySubmitted: false,
        },
      }),
      ctx(),
    );
    expect(res.status).toBe('decided');
    if (res.status === 'decided') {
      expect(res.outcome.decision).toBe('rejected');
      expect(res.outcome.reasons).toContain('NOT_ASSIGNEE');
    }
    expect(inf.calls).toBe(0);
  });

  it('rejects a mission that is not open for submission', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      input({
        mission: {
          missionId: MISSION_ID,
          status: 'cancelled',
          assigneeSpotterId: SPOTTER_ID,
          alreadySubmitted: false,
        },
      }),
      ctx(),
    );
    if (res.status === 'decided') {
      expect(res.outcome.reasons).toContain('MISSION_NOT_OPEN');
    }
    expect(inf.calls).toBe(0);
  });

  it('rejects a duplicate submission for the same mission', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      input({
        mission: {
          missionId: MISSION_ID,
          status: 'accepted',
          assigneeSpotterId: SPOTTER_ID,
          alreadySubmitted: true,
        },
      }),
      ctx(),
    );
    if (res.status === 'decided') {
      expect(res.outcome.reasons).toContain('ALREADY_SUBMITTED');
    }
    expect(inf.calls).toBe(0);
  });

  it('rejects fewer than three photos without paying for vision', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(input({ photos: [PHOTOS[0]!, PHOTOS[1]!] }), ctx());
    if (res.status === 'decided') {
      expect(res.outcome.reasons).toContain('TOO_FEW_PHOTOS');
    }
    expect(inf.calls).toBe(0);
  });

  it('rejects an empty submission rather than calling the model', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(input({ photos: [] }), ctx());
    expect(res.status).toBe('decided');
    expect(inf.calls).toBe(0);
  });
});

describe('L3 — photo reuse is actually reachable', () => {
  it('rejects a photo that matches one already seen, before paying for vision', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      // The first photo is byte-identical to one in history.
      input({ priorPhashes: ['1111111111111111'] }),
      ctx(),
    );
    expect(res.status).toBe('decided');
    if (res.status === 'decided') {
      expect(res.outcome.decision).toBe('rejected');
      expect(res.outcome.reasons).toContain('PHOTO_REUSE');
    }
    expect(inf.calls).toBe(0);
  });

  it('checks EVERY photo, not just the first', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      // Only the THIRD photo is a reuse.
      input({ priorPhashes: ['3333333333333333'] }),
      ctx(),
    );
    if (res.status === 'decided') {
      expect(res.outcome.reasons).toContain('PHOTO_REUSE');
    }
    expect(inf.calls).toBe(0);
  });

  it('a clean photo set with unrelated history still passes to vision', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    await agent.run(input({ priorPhashes: ['ffffffffffffffff'] }), ctx());
    expect(inf.calls).toBe(1);
  });
});

describe('L5 — the vision call actually receives the photographs', () => {
  it('sends every photo in a single request', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    await agent.run(input(), ctx());

    expect(inf.calls).toBe(1);
    const req = inf.requests[0]!;
    expect(req.images).toHaveLength(3);
    expect(req.images.map((i) => i.dataBase64)).toEqual([
      'aW1hZ2Ux',
      'aW1hZ2Uy',
      'aW1hZ2Uz',
    ]);
    expect(req.images.every((i) => i.mimeType === 'image/jpeg')).toBe(true);
  });
});

describe('L6 — second local confirmation is in the pipeline, not a fixture', () => {
  it('pauses after vision awaiting a second local, then resumes without re-paying', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });

    const paused = await agent.run(input(), ctx());

    expect(paused.status).toBe('awaiting_second_local');
    expect(inf.calls).toBe(1);

    if (paused.status !== 'awaiting_second_local') throw new Error('expected pause');
    const done = await agent.resume(
      paused.resumeState,
      { spotterId: OTHER_SPOTTER },
      ctx(),
    );

    // The whole point of the node split: resume must NOT re-pay for vision.
    expect(inf.calls).toBe(1);
    expect(done.status).toBe('decided');
    if (done.status === 'decided') {
      expect(done.outcome.decision).toBe('verified');
      expect(done.outcome.confirmedBySpotterId).toBe(OTHER_SPOTTER);
      expect(done.outcome.visionCalls).toBe(1);
    }
  });

  it('rejects self-confirmation — a different local is required', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const paused = await agent.run(input(), ctx());
    if (paused.status !== 'awaiting_second_local') throw new Error('expected pause');

    await expect(
      agent.resume(paused.resumeState, { spotterId: SPOTTER_ID }, ctx()),
    ).rejects.toThrow(/different spotter/i);
  });

  it('a rejected verdict never reaches the second-local pause', async () => {
    const inf = new VisionFake({ ...goodVerdict, isFranchise: true });
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(input(), ctx());
    expect(res.status).toBe('decided');
    if (res.status === 'decided') {
      expect(res.outcome.decision).toBe('rejected');
      expect(res.outcome.reasons).toContain('FRANCHISE');
    }
  });
});

describe('VerificationAgent — ladder ordering and persistence', () => {
  it('a rejected cheap rung never triggers a paid vision call (zero calls)', async () => {
    const inf = new VisionFake();
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      input({
        photos: [
          photo('aaaaaaaaaaaaaaaa'),
          photo('aaaaaaaaaaaaaaab'),
          photo('aaaaaaaaaaaaaaac'),
        ],
      }),
      ctx(),
    );
    expect(res.status).toBe('decided');
    if (res.status === 'decided') expect(res.outcome.decision).toBe('rejected');
    expect(inf.calls).toBe(0);
  });

  it('low confidence with inconclusive geo escalates to the operator', async () => {
    const inf = new VisionFake({ ...goodVerdict, confidence: 0.5 });
    const agent = new VerificationAgent({ inference: inf });
    const res = await agent.run(
      input({ captureLat: null, captureLon: null }),
      ctx(),
    );
    expect(res.status).toBe('decided');
    if (res.status === 'decided') {
      expect(res.outcome.decision).toBe('needs_operator');
    }
  });

  it('persists the pause AND the final outcome, so an interrupt survives a restart', async () => {
    const inf = new VisionFake();
    const saved: string[] = [];
    const agent = new VerificationAgent({
      inference: inf,
      persist: async (run) => {
        saved.push(run.decision);
      },
    });
    const paused = await agent.run(input(), ctx());
    if (paused.status !== 'awaiting_second_local') throw new Error('expected pause');

    // The pause itself is durable — the place sits at needs_second_local in
    // the database, visible to the spotter app and the operator CLI.
    expect(saved).toEqual(['needs_second_local']);

    await agent.resume(paused.resumeState, { spotterId: OTHER_SPOTTER }, ctx());
    expect(saved).toEqual(['needs_second_local', 'verified']);
  });
});
