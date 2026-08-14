import type { Pool } from 'pg';
import {
  VerificationAgent,
  type Inference,
  type VerificationInput,
  type VerificationOutcome,
} from '@guaca/agents';
import { photosForPlace, priorPhashesForArea } from '@guaca/db';
import type { ObjectStore } from './objectStore.js';

export interface SubmissionVerdict {
  decision: 'rejected' | 'needs_second_local' | 'needs_operator';
  reasons: string[];
  runId: string;
}

export type SubmissionResult =
  | { ok: true; verdict: SubmissionVerdict }
  | { ok: false; code: number; error: string };

/**
 * §7.4 wired to the API: assemble the submission from the database, run the
 * check ladder, persist the outcome where the operator queue and the
 * second-local flow can see it. If the vision provider is unreachable the
 * ladder does NOT silently pass — the submission escalates to the operator
 * (the cheap rungs have still run; only L5 is missing).
 */
export async function runSubmissionVerification(
  pool: Pool,
  inference: Inference,
  store: ObjectStore,
  input: { placeId: string; spotterId: string },
): Promise<SubmissionResult> {
  const placeRes = await pool.query(
    `select p.id, p.area_id, p.verification_status, p.created_by_spotter_id,
            ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
     from places p where p.id = $1`,
    [input.placeId],
  );
  const place = placeRes.rows[0];
  if (!place) return { ok: false, code: 404, error: 'place not found' };
  if (place.created_by_spotter_id !== input.spotterId) {
    return { ok: false, code: 403, error: 'only the submitting spotter can complete' };
  }
  if (place.verification_status !== 'provisional') {
    return { ok: false, code: 409, error: `place is ${place.verification_status}` };
  }

  const missionRes = await pool.query(
    `select id, status, spotter_id, offered_at, expires_at
     from missions where result_place_id = $1 order by offered_at desc limit 1`,
    [input.placeId],
  );
  const mission = missionRes.rows[0];
  if (!mission) return { ok: false, code: 409, error: 'no mission linked to this place' };

  const photoRows = await photosForPlace(pool, input.placeId);
  const photos = [];
  for (const row of photoRows) {
    const bytes = await store.get(row.storageKey);
    if (bytes) {
      photos.push({ phash: row.phash, mimeType: 'image/jpeg', dataBase64: bytes.toString('base64') });
    }
  }
  const priorPhashes = await priorPhashesForArea(pool, place.area_id, input.placeId);

  const latestCapture = photoRows.at(-1);
  const verification: VerificationInput = {
    placeId: input.placeId,
    spotterId: input.spotterId,
    mission: {
      missionId: mission.id,
      status: mission.status,
      assigneeSpotterId: mission.spotter_id,
      alreadySubmitted: false,
    },
    photos,
    priorPhashes,
    capturedAt: latestCapture?.capturedAt ?? latestCapture?.receivedAt ?? new Date(),
    missionStart: mission.offered_at,
    missionEnd: mission.expires_at,
    pinLat: place.lat,
    pinLon: place.lon,
    captureLat: latestCapture?.captureLat ?? null,
    captureLon: latestCapture?.captureLon ?? null,
    captureAccuracyM: latestCapture?.captureAccuracyM ?? null,
  };

  const agentRun = await pool.query<{ id: string }>(
    `insert into agent_runs (agent, status, input)
     values ('verification', 'running', $1) returning id`,
    [
      JSON.stringify({
        placeId: input.placeId,
        spotterId: input.spotterId,
        missionId: mission.id,
        photoCount: photos.length,
      }),
    ],
  );
  const agentRunId = agentRun.rows[0]!.id;
  const steps: Array<{ node: string; status: string }> = [];

  const agent = new VerificationAgent({
    inference,
    openMissionStatuses: ['offered', 'accepted', 'submitted'],
  });

  let outcome: VerificationOutcome;
  let visionFailed = false;
  try {
    const result = await agent.run(verification, {
      emit: (e) => steps.push({ node: e.node, status: e.status }),
      runId: agentRunId,
      loopId: input.placeId,
    });
    outcome =
      result.status === 'decided'
        ? result.outcome
        : { decision: 'needs_second_local', reasons: ['LADDER_PASSED'], visionCalls: 1 };
  } catch {
    // L0–L4 already ran (they cannot throw); the failure is the vision call.
    visionFailed = true;
    outcome = { decision: 'needs_operator', reasons: ['VISION_UNAVAILABLE'], visionCalls: 0 };
  }

  const runRes = await pool.query<{ id: string }>(
    `insert into verification_runs (place_id, agent_run_id, checks, decision, decided_by)
     values ($1, $2, $3, $4, 'agent') returning id`,
    [
      input.placeId,
      agentRunId,
      JSON.stringify({ reasons: outcome.reasons, steps, visionFailed }),
      outcome.decision === 'verified' ? 'needs_second_local' : outcome.decision,
    ],
  );
  await pool.query(
    `update agent_runs set status = $2, output = $3 where id = $1`,
    [
      agentRunId,
      outcome.decision === 'rejected' ? 'ok' : outcome.decision === 'needs_operator' ? 'escalated' : 'ok',
      JSON.stringify({ decision: outcome.decision, reasons: outcome.reasons, visionCalls: outcome.visionCalls }),
    ],
  );

  if (outcome.decision === 'rejected') {
    // The place is out; the mission reopens so the spotter can try again.
    await pool.query(
      `update places set verification_status = 'rejected', rejection_reason = $2
       where id = $1 and verification_status = 'provisional'`,
      [input.placeId, outcome.reasons[0] ?? 'REJECTED'],
    );
    await pool.query(
      `update missions set status = 'accepted', result_place_id = null
       where id = $1 and status = 'submitted'`,
      [mission.id],
    );
  }

  const decision =
    outcome.decision === 'verified' ? 'needs_second_local' : outcome.decision;
  return {
    ok: true,
    verdict: { decision, reasons: outcome.reasons, runId: runRes.rows[0]!.id },
  };
}

/**
 * The L6 gate: a second local may only confirm once the ladder has decided
 * `needs_second_local` — or an operator has approved the escalation.
 */
export async function confirmAllowed(pool: Pool, placeId: string): Promise<boolean> {
  const res = await pool.query<{ decision: string; decided_by: string }>(
    `select decision, decided_by from verification_runs
     where place_id = $1 order by created_at desc limit 1`,
    [placeId],
  );
  const latest = res.rows[0];
  if (!latest) return false;
  if (latest.decision === 'needs_second_local') return true;
  // operatorVerify flips an approved run to 'verified' while the place is
  // still provisional awaiting its second witness.
  return latest.decision === 'verified';
}
