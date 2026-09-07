import type { Pool } from 'pg';

export interface ObservationRow {
  id: string;
  placeId: string;
  kind: string;
  statementEn: string;
  statementEs: string;
  sourceKind: string;
  sourceLabel: string;
  observedAt: Date;
  validUntil: Date | null;
  status: string;
  evidencePhotoUrl: string | null;
  createdBy: string | null;
}

function mapRow(r: Record<string, unknown>): ObservationRow {
  return {
    id: r.id as string,
    placeId: r.place_id as string,
    kind: r.kind as string,
    statementEn: r.statement_en as string,
    statementEs: r.statement_es as string,
    sourceKind: r.source_kind as string,
    sourceLabel: r.source_label as string,
    observedAt: r.observed_at as Date,
    validUntil: (r.valid_until as Date | null) ?? null,
    status: r.status as string,
    evidencePhotoUrl: (r.evidence_photo_url as string | null) ?? null,
    createdBy: (r.created_by as string | null) ?? null,
  };
}

/** Facts that still read as current at the database clock. */
export async function currentObservations(pool: Pool, placeId: string): Promise<ObservationRow[]> {
  const res = await pool.query(
    `select id, place_id, kind, statement_en, statement_es, source_kind, source_label,
            observed_at, valid_until, status, evidence_photo_url, created_by
       from place_observations_current
      where place_id = $1
      order by observed_at desc`,
    [placeId],
  );
  return res.rows.map(mapRow);
}

export async function observationsForPlace(pool: Pool, placeId: string): Promise<ObservationRow[]> {
  const res = await pool.query(
    `select id, place_id, kind, statement_en, statement_es, source_kind, source_label,
            observed_at, valid_until, status, evidence_photo_url, created_by
       from place_observations
      where place_id = $1
      order by observed_at desc`,
    [placeId],
  );
  return res.rows.map(mapRow);
}
