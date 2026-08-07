import { z } from 'zod';
import type { Inference } from '../inference/types.js';
import { checkFreshness, checkGeoDistance } from './rungs12.js';
import { checkPhotoReuse, checkIntraDiversity } from './rungs34.js';
import { decideSubmission, type VisionVerdict } from './fusion.js';

export interface VerificationPhoto {
  phash: string;
  mimeType: string;
  /** The actual bytes. L5 cannot verify a photo it never receives. */
  dataBase64: string;
}

export interface MissionContext {
  missionId: string;
  status: string;
  assigneeSpotterId: string;
  alreadySubmitted: boolean;
}

export interface VerificationInput {
  placeId: string;
  spotterId: string;
  mission: MissionContext;
  photos: VerificationPhoto[];
  /** pHashes already seen — this spotter's history, the zone, the seed set. */
  priorPhashes: readonly string[];
  capturedAt: Date;
  missionStart: Date;
  missionEnd: Date;
  pinLat: number;
  pinLon: number;
  captureLat: number | null;
  captureLon: number | null;
  captureAccuracyM?: number | null;
  spotterConsecutiveAccepted?: number;
}

export interface VerificationRunEvent {
  node: string;
  status: 'ok' | 'rejected' | 'escalated' | 'paused';
}

export interface VerificationOutcome {
  decision: 'rejected' | 'verified' | 'needs_second_local' | 'needs_operator';
  reasons: string[];
  visionCalls: number;
  confirmedBySpotterId?: string;
}

export interface AgentCtx {
  emit: (e: VerificationRunEvent) => void;
  runId: string;
  loopId: string;
}

/**
 * State captured at the second-local pause. Everything expensive has already
 * happened; resuming replays only the confirmation node.
 */
export interface VerificationPausedState {
  placeId: string;
  spotterId: string;
  missionId: string;
  visionCalls: number;
  reasons: string[];
}

export type VerificationResult =
  | { status: 'decided'; outcome: VerificationOutcome }
  | {
      status: 'awaiting_second_local';
      placeId: string;
      resumeState: VerificationPausedState;
    };

export interface VerificationAgentOptions {
  inference: Inference;
  /** Persistence hook — writes verification_runs + agent_runs. */
  persist?: (outcome: VerificationOutcome) => Promise<void> | void;
  /** Statuses a mission may hold and still accept a submission. */
  openMissionStatuses?: readonly string[];
  minPhotos?: number;
}

const VISION_SCHEMA = z.object({
  showsRealPlace: z.boolean(),
  categoryMatch: z.boolean(),
  isFranchise: z.boolean(),
  isScreenshot: z.boolean(),
  isStockLike: z.boolean(),
  confidence: z.number(),
  reasons: z.array(z.string()),
});

/**
 * The verification check ladder (plan §7.4), cheapest → most expensive:
 *
 *   L0 integrity → L1 freshness → L2 geo → L3 reuse → L4 diversity
 *      → L5 vision (the ONE paid call) → fusion → L6 second local
 *
 * Two properties this class exists to guarantee:
 *
 *  1. A rejected rung NEVER pays for L5. Every early exit returns with
 *     visionCalls still 0, and there is a test per rung asserting it.
 *  2. The second-local pause happens in a node AFTER the vision node, never
 *     inside it. Resuming replays only `confirmSecondLocal`, so a human
 *     response cannot re-charge the most expensive operation in the system —
 *     which is precisely what LangGraph's interrupt() re-execution semantics
 *     would do if these were one node (§7.7).
 */
export class VerificationAgent {
  private readonly inference: Inference;
  private readonly persist?: VerificationAgentOptions['persist'];
  private readonly openStatuses: readonly string[];
  private readonly minPhotos: number;

  constructor(options: VerificationAgentOptions) {
    this.inference = options.inference;
    this.persist = options.persist;
    this.openStatuses = options.openMissionStatuses ?? ['offered', 'accepted'];
    this.minPhotos = options.minPhotos ?? 3;
  }

  async run(input: VerificationInput, ctx: AgentCtx): Promise<VerificationResult> {
    // ── L0 integrity ────────────────────────────────────────────────────
    const integrity = this.checkIntegrity(input);
    if (integrity) return this.reject(integrity, ctx);

    // ── L1 freshness ────────────────────────────────────────────────────
    const fresh = checkFreshness(input.capturedAt, input.missionStart, input.missionEnd);
    if (fresh.hard) return this.reject('STALE_CAPTURE', ctx);

    // ── L2 geo ──────────────────────────────────────────────────────────
    const geo = checkGeoDistance(
      input.captureLat,
      input.captureLon,
      input.captureAccuracyM ?? null,
      { lat: input.pinLat, lon: input.pinLon },
    );
    if (geo.verdict === 'HARD') return this.reject('GEO_TOO_FAR', ctx);

    // ── L3 reuse — EVERY photo against the supplied history ─────────────
    let originalityScore = 1;
    for (const p of input.photos) {
      const reuse = checkPhotoReuse(p.phash, input.priorPhashes, input.priorPhashes.length);
      if (reuse.verdict === 'HARD') {
        return this.reject(reuse.reason ?? 'PHOTO_REUSE', ctx);
      }
      if (reuse.verdict === 'WEAK') originalityScore = Math.min(originalityScore, 0.5);
    }

    // ── L4 diversity ────────────────────────────────────────────────────
    const diversity = checkIntraDiversity(input.photos.map((p) => p.phash));
    if (diversity.verdict === 'HARD') {
      return this.reject(diversity.reason ?? 'NO_DIVERSITY', ctx);
    }

    // ── L5 vision — the ONE paid call, ALL photos in a single request ───
    ctx.emit({ node: 'visionVerify', status: 'ok' });
    const visionRes = await this.inference.vision<VisionVerdict>({
      schema: VISION_SCHEMA,
      purpose: 'verify.vision',
      maxOutputTokens: 200,
      system:
        'You inspect photographs of a place a local claims to have visited. ' +
        'Report only what the images show.',
      images: input.photos.map((p) => ({
        mimeType: p.mimeType,
        dataBase64: p.dataBase64,
      })),
      user: 'Do these photographs show a real place matching the claimed category?',
    });
    const visionCalls = 1;

    // ── Fusion — deterministic, no model in the decision ────────────────
    const decision = decideSubmission({
      gpsScore: geo.score,
      freshnessScore: fresh.pass ? 1 : 0,
      originalityScore,
      vision: visionRes.raw,
      spotterConsecutiveAccepted: input.spotterConsecutiveAccepted ?? 0,
      geoInconclusive: geo.verdict === 'INCONCLUSIVE',
    });

    if (decision.verdict === 'REJECT') {
      ctx.emit({ node: 'fusion', status: 'rejected' });
      return this.finish(
        { decision: 'rejected', reasons: decision.reasons, visionCalls },
        ctx,
      );
    }
    if (decision.verdict === 'ESCALATE') {
      ctx.emit({ node: 'fusion', status: 'escalated' });
      return this.finish(
        { decision: 'needs_operator', reasons: decision.reasons, visionCalls },
        ctx,
      );
    }

    // ── L6 second local — PAUSE. A separate node, after the paid one. ───
    // The pause is written to the database, not held in memory: an interrupt
    // must survive a process restart, and the spotter app and operator CLI
    // both need to see the place sitting at `needs_second_local` (§7.7).
    ctx.emit({ node: 'requestSecondLocal', status: 'paused' });
    if (this.persist) {
      await this.persist({
        decision: 'needs_second_local',
        reasons: decision.reasons,
        visionCalls,
      });
    }
    return {
      status: 'awaiting_second_local',
      placeId: input.placeId,
      resumeState: {
        placeId: input.placeId,
        spotterId: input.spotterId,
        missionId: input.mission.missionId,
        visionCalls,
        reasons: decision.reasons,
      },
    };
  }

  /**
   * Resume after a second local responds. Replays ONLY the confirmation node:
   * no rung re-runs, and the vision call is not repeated. `visionCalls` is
   * carried through from the paused state so the count is provable end to end.
   */
  async resume(
    state: VerificationPausedState,
    confirmation: { spotterId: string },
    ctx: AgentCtx,
  ): Promise<VerificationResult> {
    if (confirmation.spotterId === state.spotterId) {
      throw new Error(
        'self-confirmation rejected: a different spotter must confirm',
      );
    }
    ctx.emit({ node: 'confirmSecondLocal', status: 'ok' });
    return this.finish(
      {
        decision: 'verified',
        reasons: [...state.reasons, 'SECOND_LOCAL_CONFIRMED'],
        visionCalls: state.visionCalls,
        confirmedBySpotterId: confirmation.spotterId,
      },
      ctx,
    );
  }

  /** L0 — returns a rejection reason, or null when the submission is sane. */
  private checkIntegrity(input: VerificationInput): string | null {
    if (!this.openStatuses.includes(input.mission.status)) return 'MISSION_NOT_OPEN';
    if (input.mission.alreadySubmitted) return 'ALREADY_SUBMITTED';
    if (input.mission.assigneeSpotterId !== input.spotterId) return 'NOT_ASSIGNEE';
    if (input.photos.length < this.minPhotos) return 'TOO_FEW_PHOTOS';
    return null;
  }

  private async reject(reason: string, ctx: AgentCtx): Promise<VerificationResult> {
    ctx.emit({ node: 'cheapLadder', status: 'rejected' });
    return this.finish({ decision: 'rejected', reasons: [reason], visionCalls: 0 }, ctx);
  }

  private async finish(
    outcome: VerificationOutcome,
    _ctx: AgentCtx,
  ): Promise<VerificationResult> {
    if (this.persist) await this.persist(outcome);
    return { status: 'decided', outcome };
  }
}
