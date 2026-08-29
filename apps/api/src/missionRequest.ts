import type { Pool } from 'pg';
import { runGapAgent } from '@guaca/agents';
import { clusterUnanswered, gapAgentOptions } from './gapAgentDeps.js';

export type MissionRequestResult =
  | { status: 'commissioned' | 'already_open'; missionId: string; spotterName: string; expiresAt: string }
  | { status: 'not_found' | 'no_intent' | 'no_gap' }
  | { status: 'budget' | 'no_spotter' | 'needs_approval' | 'declined'; detail: string | null };

/**
 * The traveller asks for a local to be sent for a refused question. The
 * same gap agent the scheduler runs, scoped to that question's gap, with
 * the score floor dropped and the demand gates skipped (the demand is
 * explicit); the daily cap, the reward cap and spotter selection still
 * apply. The traveller is put on the question's watch so the answer
 * reaches them. Used by the REST route and by the concierge turn.
 */
export async function requestMission(pool: Pool, questionId: string, touristId: string): Promise<MissionRequestResult> {
  const qrow = await pool.query<{ id: string; area_id: string | null; category: string | null; h3_8: string | null }>(
    `select id, area_id, intent->>'category' as category, intent->>'h3_8' as h3_8 from questions where id = $1`,
    [questionId],
  );
  const question = qrow.rows[0];
  if (!question) return { status: 'not_found' };
  if (!question.area_id || !question.category || !question.h3_8) return { status: 'no_intent' };
  await pool.query(
    `insert into question_notifications (question_id, tourist_id) values ($1, $2) on conflict do nothing`,
    [questionId, touristId],
  );
  await clusterUnanswered(pool, question.area_id);
  const gapRow = await pool.query<{ id: string; category: string; h3_8: string; question_count: number; distinct_session_count: number; last_asked_at: Date | null }>(
    `select id, category, h3_8, question_count, distinct_session_count, last_asked_at from gaps
      where area_id = $1 and category = $2 and h3_8 = $3`,
    [question.area_id, question.category, question.h3_8],
  );
  const gap = gapRow.rows[0];
  if (!gap) return { status: 'no_gap' };

  const describe = async (missionId?: string) => {
    const m = await pool.query<{ id: string; expires_at: Date; spotter: string }>(
      `select m.id, m.expires_at, s.name as spotter from missions m join spotters s on s.id = m.spotter_id
        where m.gap_id = $1 and m.status in ('offered','accepted','submitted') ${missionId ? 'and m.id = $2' : ''}
        order by m.offered_at desc limit 1`,
      missionId ? [gap.id, missionId] : [gap.id],
    );
    const row = m.rows[0];
    if (!row) return null;
    const [first, last] = row.spotter.split(/\s+/);
    return { missionId: row.id, spotterName: last ? `${first} ${last[0]}.` : first!, expiresAt: row.expires_at.toISOString() };
  };
  const open = await describe();
  if (open) return { status: 'already_open', ...open };

  const result = await runGapAgent(
    gapAgentOptions(pool, {
      areaId: question.area_id,
      dryRun: false,
      minScore: 0,
      explicit: true,
      listGaps: async () => [{
        id: gap.id, category: gap.category, h3_8: gap.h3_8,
        questionCount: gap.question_count, distinctSessionCount: gap.distinct_session_count,
        lastAskedAt: gap.last_asked_at ? gap.last_asked_at.toISOString() : null,
      }],
    }),
  );
  const done = result.commissioned[0];
  if (done?.missionId) {
    const m = await describe(done.missionId);
    console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'mission.requested_by_tourist', detail: { questionId, gapId: gap.id, missionId: done.missionId } }));
    if (m) return { status: 'commissioned', ...m };
  }
  const why = result.explained.join(' ').toLowerCase();
  const status = /daily cap/.test(why) ? 'budget' : /spotter/.test(why) ? 'no_spotter' : /approval|reward/.test(why) ? 'needs_approval' : 'declined';
  console.log(JSON.stringify({ ts: new Date().toISOString(), level: 'info', event: 'mission.request_declined', detail: { questionId, gapId: gap.id, status, explained: result.explained } }));
  return { status, detail: result.explained.slice(-1)[0] ?? null };
}
