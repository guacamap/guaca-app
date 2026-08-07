import type { Pool } from 'pg';

export interface RecordQuestionInput {
  rawText: string;
  language: string;
  /** Taxonomy category from the deterministic lexicon — never a model call. */
  category: string;
  lat: number;
  lon: number;
  answered: boolean;
  answerPlaceIds?: string[];
  refusalReason?: string | null;
  sessionId?: string | null;
  propertyId?: string | null;
}

export interface RecordedQuestion {
  questionId: string;
  sessionId: string;
  areaId: string | null;
  h3_8: string;
}

/**
 * Persist every tourist question — answered or refused.
 *
 * This is the hinge of the core loop. A refusal that is not written down is
 * not a demand signal: `clusterUnanswered` reads `questions where answered =
 * false`, so if nothing lands here the gap agent has nothing to aggregate and
 * no mission is ever commissioned. "The AI's own ignorance becomes a local's
 * paycheck" is only true if the ignorance is recorded.
 *
 * The intent stored is `{category, h3_8}` — exactly the cluster key the gap
 * agent groups by. h3 is computed in Postgres so the cell index matches the
 * one the clustering query would derive.
 */
export async function recordQuestion(
  pool: Pool,
  input: RecordQuestionInput,
): Promise<RecordedQuestion> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    // Anonymous sessions are the norm: the tourist scans a QR, no account.
    let sessionId = input.sessionId ?? null;
    if (!sessionId) {
      const s = await client.query<{ id: string }>(
        `insert into sessions (property_id, language) values ($1, $2) returning id`,
        [input.propertyId ?? null, input.language.slice(0, 2)],
      );
      sessionId = s.rows[0]!.id;
    }

    // Resolve the area from the point, and derive the h3 res-8 cell.
    const geo = await client.query<{ area_id: string | null; h3_8: string }>(
      `select (select a.id from areas a
                where ST_Covers(a.geom, ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography)
                limit 1) as area_id,
              h3_lat_lng_to_cell(point($2, $1), 8)::text as h3_8`,
      [input.lat, input.lon],
    );
    const areaId = geo.rows[0]?.area_id ?? null;
    const h3_8 = geo.rows[0]!.h3_8;

    const q = await client.query<{ id: string }>(
      `insert into questions
         (session_id, property_id, area_id, raw_text, language, intent,
          answered, answer_place_ids, refusal_reason)
       values ($1, $2, $3, $4, $5, $6::jsonb, $7, $8::uuid[], $9)
       returning id`,
      [
        sessionId,
        input.propertyId ?? null,
        areaId,
        input.rawText,
        input.language.slice(0, 2),
        JSON.stringify({ category: input.category, h3_8 }),
        input.answered,
        input.answerPlaceIds ?? [],
        input.refusalReason ?? null,
      ],
    );

    await client.query('commit');
    return { questionId: q.rows[0]!.id, sessionId, areaId, h3_8 };
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
