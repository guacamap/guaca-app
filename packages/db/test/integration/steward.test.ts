import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type pg from 'pg';
import { migrate } from '../../src/migrate.ts';
import {
  unenrichedCandidates,
  saveDraft,
  stewardDrafts,
  approveDraft,
  rejectDraft,
} from '../../src/steward.ts';
import { createTempDb, dropTempDb } from '../helpers/tmpDb.ts';

const DB = 'guaca_steward';
const AREA = '00000000-0000-4000-8000-00000000000a';

const DRAFT = {
  category: 'eat_drink',
  landmarkHint: 'En la esquina de la calle Bolívar, puerta azul',
  whyLikely: 'OSM tags amenity=restaurant, cuisine=arepa',
  photoChecklist: ['fachada', 'letrero', 'arepas'],
  suggestedTags: ['arepas', 'casual'],
};

describe('candidate drafts — the AI steward queue', () => {
  let pool: pg.Pool;
  let candidateId: string;

  beforeAll(async () => {
    pool = await createTempDb(DB);
    const c = await pool.connect();
    await migrate(c);
    await c.query(
      `insert into areas(id,name,slug,country,timezone,geom) values ($1,'PC','pc','VE','America/Caracas', ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA],
    );
    const cand = await c.query<{ id: string }>(
      `insert into places (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count, tags, osm_type, osm_id)
       values ($1, 'Restaurante El Sabor', 'eat_drink', 'Punto en OpenStreetMap',
         ST_SetSRID(ST_MakePoint(-68.0056, 10.4716), 4326)::geography, '8a0000000000000',
         'osm_candidate', 'candidate', 0, '{restaurant,arepa}', 'node', 12345)
       returning id`,
      [AREA],
    );
    candidateId = cand.rows[0]!.id;
    // A verified place must never enter the steward's worklist.
    await c.query(
      `insert into spotters (id, name, phone, area_id) values
         ('00000000-0000-4000-8000-0000000000c1', 'A', '+58001', $1),
         ('00000000-0000-4000-8000-0000000000c2', 'B', '+58002', $1)`,
      [AREA],
    );
    await c.query(
      `insert into places (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count, created_by_spotter_id, confirmed_by_spotter_id)
       values ($1, 'Real Place', 'eat_drink', 'real',
         ST_SetSRID(ST_MakePoint(-68.0057, 10.4717), 4326)::geography, '8a0000000000000',
         'spotter', 'verified', 2, '00000000-0000-4000-8000-0000000000c1', '00000000-0000-4000-8000-0000000000c2')`,
      [AREA],
    );
    c.release();
  });
  afterAll(async () => {
    await dropTempDb(DB, pool);
  });

  it('the worklist holds OSM candidates only — never verified places', async () => {
    const list = await unenrichedCandidates(pool, { limit: 10, areaId: AREA });
    expect(list.map((x) => x.id)).toEqual([candidateId]);
    expect(list[0]!.tags).toContain('arepa');
  });

  it('saving twice replaces the pending draft instead of stacking', async () => {
    await saveDraft(pool, { candidateId, model: 'm1', draft: DRAFT });
    await saveDraft(pool, {
      candidateId,
      model: 'm2',
      draft: { ...DRAFT, landmarkHint: 'segunda versión' },
    });
    const pending = await stewardDrafts(pool, 'pending');
    expect(pending).toHaveLength(1);
    expect(pending[0]!.draft.landmarkHint).toBe('segunda versión');
    expect(pending[0]!.model).toBe('m2');
  });

  it('approve enriches the CANDIDATE (not a verified place) and is audited', async () => {
    const pending = await stewardDrafts(pool, 'pending');
    const res = await approveDraft(pool, pending[0]!.id, 'rob', 'looks right');
    expect(res.ok).toBe(true);

    const place = await pool.query<{
      category: string;
      landmark_description: string;
      tags: string[];
      verification_status: string;
    }>(`select category, landmark_description, tags, verification_status from places where id = $1`, [candidateId]);
    const p = place.rows[0]!;
    // Enriched — but STILL a candidate: no tourist visibility, no skipped rungs.
    expect(p.verification_status).toBe('candidate');
    expect(p.category).toBe('eat_drink');
    expect(p.landmark_description).toBe('segunda versión');
    expect(p.tags).toContain('arepas');

    const audit = await pool.query(
      `select count(*)::int as n from operator_actions where action = 'steward.approve' and target_id = $1`,
      [pending[0]!.id],
    );
    expect(audit.rows[0]!.n).toBe(1);

    // Double-approve is refused — the queue is single-shot per draft.
    const again = await approveDraft(pool, pending[0]!.id, 'rob');
    expect(again).toEqual({ ok: false, reason: 'already reviewed' });
  });

  it('an approved candidate leaves the worklist; reject keeps a paper trail', async () => {
    expect(await unenrichedCandidates(pool, { limit: 10, areaId: AREA })).toHaveLength(0);

    // A second candidate for the reject path.
    const c2 = await pool.query<{ id: string }>(
      `insert into places (area_id, name, category, landmark_description, location, h3_8,
         source, verification_status, witness_count, osm_type, osm_id)
       values ($1, 'Taller X', 'services', 'Punto en OpenStreetMap',
         ST_SetSRID(ST_MakePoint(-68.0058, 10.4718), 4326)::geography, '8a0000000000000',
         'osm_candidate', 'candidate', 0, 'node', 6789)
       returning id`,
      [AREA],
    );
    await saveDraft(pool, {
      candidateId: c2.rows[0]!.id,
      model: 'm1',
      draft: { ...DRAFT, category: 'services' },
    });
    const pending = await stewardDrafts(pool, 'pending');
    const res = await rejectDraft(pool, pending[0]!.id, 'rob', 'wrong category');
    expect(res.ok).toBe(true);
    const place = await pool.query<{ category: string }>(
      `select category from places where id = $1`,
      [c2.rows[0]!.id],
    );
    expect(place.rows[0]!.category).toBe('services'); // rejection leaves the candidate untouched
    expect(await stewardDrafts(pool, 'rejected')).toHaveLength(1);
  });
});
