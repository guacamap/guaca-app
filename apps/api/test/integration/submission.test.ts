import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { SignJWT } from 'jose';
import { z } from 'zod';
import { buildApp } from '../../src/app.ts';
import { memoryObjectStore } from '../../src/objectStore.ts';
import { migrate, pendingOperatorQueue, operatorVerify } from '@guaca/db';
import { FakeInference } from '@guaca/agents';

const TEST_DB = 'guaca_submission_api';
const url = (db: string) =>
  (process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca').replace(
    /\/guaca$/,
    '/' + db,
  );
const pool = new pg.Pool({ connectionString: url(TEST_DB) });

const AREA_ID = '00000000-0000-4000-8000-00000000000a';
const AREA_B = '00000000-0000-4000-8000-00000000000b';
const YORMAN = '00000000-0000-4000-8000-0000000000c1';
const MARIA = '00000000-0000-4000-8000-0000000000c2';
const SECRET = new TextEncoder().encode('changeme-32-bytes-min!');

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '../fixtures');
const PHOTOS = ['front.jpg', 'sign.jpg', 'street.jpg'].map((f) =>
  readFileSync(join(FIXTURES, f)).toString('base64'),
);

async function spotterToken(id: string): Promise<string> {
  return new SignJWT({ sub: id, name: 'test', role: 'spotter' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

/** The exact vision request the agent builds — same key, same fixture. */
function visionFixture(photoCount: number, verdict: Record<string, unknown>) {
  const schema = z.object({
    showsRealPlace: z.boolean(),
    categoryMatch: z.boolean(),
    isFranchise: z.boolean(),
    isScreenshot: z.boolean(),
    isStockLike: z.boolean(),
    confidence: z.number(),
    reasons: z.array(z.string()),
  });
  const probe = new FakeInference({});
  const key = probe.keyFor({
    schema,
    purpose: 'verify.vision',
    maxOutputTokens: 200,
    system:
      'You inspect photographs of a place a local claims to have visited. ' +
      'Report only what the images show.',
    images: Array.from({ length: photoCount }, () => ({ mimeType: 'image/jpeg', dataBase64: '' })),
    user: 'Do these photographs show a real place matching the claimed category?',
  });
  return { [key]: verdict };
}

let areaSeq = 0;
/** A pristine area per L5-reaching test — the L3 reuse rung reads the whole
 *  area's photo history, so shared ground makes tests interfere. */
async function mkFreshArea(): Promise<{ areaId: string; lat: number; lon: number }> {
  areaSeq += 1;
  const lat = 11 + areaSeq * 0.3;
  const lon = -68.5;
  const poly = `POLYGON((${lon - 0.05} ${lat - 0.05},${lon + 0.05} ${lat - 0.05},${lon + 0.05} ${lat + 0.05},${lon - 0.05} ${lat + 0.05},${lon - 0.05} ${lat - 0.05}))`;
  const res = await pool.query<{ id: string }>(
    `insert into areas (name, slug, country, timezone, geom)
     values ($1, $2, 'VE', 'America/Caracas', ST_GeogFromText($3)) returning id`,
    [`Área ${areaSeq}`, `area-${areaSeq}`, poly],
  );
  return { areaId: res.rows[0]!.id, lat, lon };
}

let gapSeq = 0;
async function mkMission(spotterId: string, areaId = AREA_ID): Promise<string> {
  gapSeq += 1;
  const gap = await pool.query<{ id: string }>(
    `insert into gaps (area_id, category, h3_8, question_count, distinct_session_count, status)
     values ($1, 'market_shop', $2, 3, 3, 'commissioned') returning id`,
    [areaId, `88674304${gapSeq}ffff`],
  );
  const mission = await pool.query<{ id: string }>(
    `insert into missions (gap_id, spotter_id, brief, target_category, target_h3,
                           reward_minor, status, created_by, expires_at)
     values ($1, $2, 'test brief', 'market_shop', 'h3', 300, 'accepted', 'operator',
             now() + interval '2 days') returning id`,
    [gap.rows[0]!.id, spotterId],
  );
  return mission.rows[0]!.id;
}

async function submitAndPhotograph(
  app: ReturnType<typeof buildApp>,
  token: string,
  missionId: string,
  photoCount: number,
  at: { lat: number; lon: number } = { lat: 10.4716, lon: -68.0056 },
): Promise<string> {
  const submit = await app.inject({
    method: 'POST',
    url: '/api/spotter/places',
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: `Puesto de prueba ${missionId.slice(0, 8)}`,
      category: 'market_shop',
      landmarkDescription: 'Frente a la plaza, toldo verde junto a la farmacia',
      lat: at.lat,
      lon: at.lon,
      missionId,
    },
  });
  expect(submit.statusCode).toBe(201);
  const placeId = (submit.json() as { placeId: string }).placeId;
  for (let i = 0; i < photoCount; i++) {
    const photo = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        placeId,
        imageBase64: PHOTOS[i]!,
        captureLat: at.lat,
        captureLon: at.lon,
        captureAccuracyM: 8,
        capturedAt: new Date().toISOString(),
      },
    });
    expect(photo.statusCode).toBe(201);
  }
  return placeId;
}

beforeAll(async () => {
  const admin = new pg.Pool({ connectionString: url('postgres') });
  const exists = await admin.query('select 1 from pg_database where datname = $1', [TEST_DB]);
  if (exists.rows.length === 0) await admin.query(`create database ${TEST_DB}`);
  await admin.end();
  const client = await pool.connect();
  try {
    await client.query('drop schema if exists public cascade');
    await client.query('create schema if not exists public');
    await migrate(client);
    await client.query(
      `insert into areas (id, name, slug, country, timezone, geom) values
        ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
         ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))`,
      [AREA_ID],
    );
    // A second, disjoint area: L3's reuse rung reads the whole area's photo
    // history, so tests that must reach L5 need pristine prior-phash ground.
    await client.query(
      `insert into areas (id, name, slug, country, timezone, geom) values
        ($1, 'Patanemo', 'patanemo', 'VE', 'America/Caracas',
         ST_GeogFromText('POLYGON((-68.25 10.55,-68.15 10.55,-68.15 10.65,-68.25 10.65,-68.25 10.55))'))`,
      [AREA_B],
    );
    await client.query(
      `insert into spotters (id, name, phone, area_id) values
        ($1, 'Yorman', '+58 412 000 0001', $3),
        ($2, 'María', '+58 412 000 0002', $3)`,
      [YORMAN, MARIA, AREA_ID],
    );
  } finally {
    client.release();
  }
});

afterAll(async () => {
  await pool.end();
});

describe('§7.4 — the check ladder runs on submission', () => {
  it('full happy path: ladder passes → second local confirms → verified', async () => {
    const fixtures = visionFixture(3, {
      showsRealPlace: true,
      categoryMatch: true,
      isFranchise: false,
      isScreenshot: false,
      isStockLike: false,
      confidence: 0.92,
      reasons: [],
    });
    const fake = new FakeInference(fixtures);
    const store = memoryObjectStore();
    const app = buildApp({ pool, inference: fake, objectStore: store });
    const fresh = await mkFreshArea();
    const missionId = await mkMission(YORMAN, fresh.areaId);
    const tokenY = await spotterToken(YORMAN);

    const placeId = await submitAndPhotograph(app, tokenY, missionId, 3, { lat: fresh.lat, lon: fresh.lon });
    expect(store.size()).toBe(3); // bytes actually landed in the object store

    // Second local cannot jump the ladder.
    const tokenM = await spotterToken(MARIA);
    const early = await app.inject({
      method: 'POST',
      url: `/api/spotter/places/${placeId}/confirm`,
      headers: { authorization: `Bearer ${tokenM}` },
      payload: { lat: fresh.lat, lon: fresh.lon },
    });
    expect(early.statusCode).toBe(409);
    expect((early.json() as { error: string }).error).toBe('VERIFICATION_PENDING');

    const complete = await app.inject({
      method: 'POST',
      url: `/api/spotter/submissions/${placeId}/complete`,
      headers: { authorization: `Bearer ${tokenY}` },
    });
    expect(complete.statusCode).toBe(200);
    const verdict = complete.json() as { decision: string };
    expect(verdict.decision).toBe('needs_second_local');
    expect(fake.calls.filter((c) => c.method === 'vision')).toHaveLength(1); // ONE paid call

    // A second local who is NOT there cannot confirm — "on the ground" is
    // enforced server-side, not by the client's honesty. Checked while the
    // place is still confirmable, so a 422 can only come from the distance.
    const farAway = await app.inject({
      method: 'POST',
      url: `/api/spotter/places/${placeId}/confirm`,
      headers: { authorization: `Bearer ${tokenM}` },
      payload: { lat: fresh.lat + 1, lon: fresh.lon + 1 },
    });
    expect(farAway.statusCode).toBe(422);
    expect((farAway.json() as { error: string }).error).toBe('TOO_FAR_TO_CONFIRM');

    // And coordinates are mandatory: no location, no confirmation.
    const noGeo = await app.inject({
      method: 'POST',
      url: `/api/spotter/places/${placeId}/confirm`,
      headers: { authorization: `Bearer ${tokenM}` },
      payload: {},
    });
    expect(noGeo.statusCode).toBe(400);

    const confirm = await app.inject({
      method: 'POST',
      url: `/api/spotter/places/${placeId}/confirm`,
      headers: { authorization: `Bearer ${tokenM}` },
      payload: { lat: fresh.lat, lon: fresh.lon },
    });
    expect(confirm.statusCode).toBe(200);

    const place = await pool.query(
      `select verification_status, witness_count from places where id = $1`,
      [placeId],
    );
    expect(place.rows[0]).toMatchObject({ verification_status: 'verified', witness_count: 2 });
    const mission = await pool.query(`select status from missions where id = $1`, [missionId]);
    expect(mission.rows[0]!.status).toBe('verified');
    await app.close();
  });

  it('complete is idempotent — a retry replays the verdict without a second paid call', async () => {
    const fixtures = visionFixture(3, {
      showsRealPlace: true,
      categoryMatch: true,
      isFranchise: false,
      isScreenshot: false,
      isStockLike: false,
      confidence: 0.92,
      reasons: [],
    });
    const fake = new FakeInference(fixtures);
    const app = buildApp({ pool, inference: fake, objectStore: memoryObjectStore() });
    const fresh = await mkFreshArea();
    const missionId = await mkMission(YORMAN, fresh.areaId);
    const tokenY = await spotterToken(YORMAN);
    const placeId = await submitAndPhotograph(app, tokenY, missionId, 3, { lat: fresh.lat, lon: fresh.lon });

    // Replaying the place submission returns the SAME place, no duplicate.
    const resubmit = await app.inject({
      method: 'POST',
      url: '/api/spotter/places',
      headers: { authorization: `Bearer ${tokenY}` },
      payload: {
        name: 'Duplicado', category: 'market_shop', landmarkDescription: 'no importa dónde',
        lat: fresh.lat, lon: fresh.lon, missionId,
      },
    });
    expect(resubmit.statusCode).toBe(200);
    expect((resubmit.json() as { placeId: string }).placeId).toBe(placeId);

    const first = await app.inject({
      method: 'POST',
      url: `/api/spotter/submissions/${placeId}/complete`,
      headers: { authorization: `Bearer ${tokenY}` },
    });
    expect((first.json() as { decision: string }).decision).toBe('needs_second_local');
    const second = await app.inject({
      method: 'POST',
      url: `/api/spotter/submissions/${placeId}/complete`,
      headers: { authorization: `Bearer ${tokenY}` },
    });
    expect(second.statusCode).toBe(200);
    const replay = second.json() as { decision: string; reasons: string[] };
    expect(replay.decision).toBe('needs_second_local');
    expect(replay.reasons).toContain('ALREADY_DECIDED');
    // The paid rung ran exactly once across both calls.
    expect(fake.calls.filter((c) => c.method === 'vision')).toHaveLength(1);
    await app.close();
  });

  it('a spotter cannot attach photos to a place they did not submit', async () => {
    const app = buildApp({ pool, inference: new FakeInference({}), objectStore: memoryObjectStore() });
    const missionId = await mkMission(YORMAN);
    const tokenY = await spotterToken(YORMAN);
    const placeId = await submitAndPhotograph(app, tokenY, missionId, 1);
    const tokenM = await spotterToken(MARIA);
    const res = await app.inject({
      method: 'POST',
      url: '/api/photos',
      headers: { authorization: `Bearer ${tokenM}` },
      payload: { placeId, imageBase64: PHOTOS[1]! },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it('unreadable photo bytes escalate to the operator — never a rejection', async () => {
    const brokenStore = {
      ...memoryObjectStore(),
      async get() { return null; }, // the store took the bytes but cannot serve them
    };
    const app = buildApp({ pool, inference: new FakeInference({}), objectStore: brokenStore });
    const missionId = await mkMission(YORMAN);
    const tokenY = await spotterToken(YORMAN);
    const placeId = await submitAndPhotograph(app, tokenY, missionId, 3);
    const complete = await app.inject({
      method: 'POST',
      url: `/api/spotter/submissions/${placeId}/complete`,
      headers: { authorization: `Bearer ${tokenY}` },
    });
    const verdict = complete.json() as { decision: string; reasons: string[] };
    expect(verdict.decision).toBe('needs_operator');
    expect(verdict.reasons).toContain('PHOTO_BYTES_UNAVAILABLE');
    const place = await pool.query(`select verification_status from places where id = $1`, [placeId]);
    expect(place.rows[0]!.verification_status).toBe('provisional');
    await app.close();
  });

  it('vision unreachable → escalates to the operator, then confirm unlocks', async () => {
    const fake = new FakeInference({}); // no fixture: the vision call throws
    const app = buildApp({ pool, inference: fake, objectStore: memoryObjectStore() });
    const fresh = await mkFreshArea();
    const missionId = await mkMission(YORMAN, fresh.areaId);
    const tokenY = await spotterToken(YORMAN);
    const placeId = await submitAndPhotograph(app, tokenY, missionId, 3, { lat: fresh.lat, lon: fresh.lon });

    const complete = await app.inject({
      method: 'POST',
      url: `/api/spotter/submissions/${placeId}/complete`,
      headers: { authorization: `Bearer ${tokenY}` },
    });
    expect(complete.statusCode).toBe(200);
    const verdict = complete.json() as { decision: string; reasons: string[]; runId: string };
    expect(verdict.decision).toBe('needs_operator');
    expect(verdict.reasons).toContain('VISION_UNAVAILABLE');

    const queue = await pendingOperatorQueue(pool);
    expect(queue.map((qi) => qi.placeId)).toContain(placeId);

    const approved = await operatorVerify(pool, verdict.runId, 'APPROVE', 'test-operator');
    expect(approved.ok).toBe(true);

    const tokenM = await spotterToken(MARIA);
    const confirm = await app.inject({
      method: 'POST',
      url: `/api/spotter/places/${placeId}/confirm`,
      headers: { authorization: `Bearer ${tokenM}` },
      payload: { lat: fresh.lat, lon: fresh.lon },
    });
    expect(confirm.statusCode).toBe(200);
    await app.close();
  });

  it('too few photos → rejected, place marked, mission reopened for retry', async () => {
    const app = buildApp({ pool, inference: new FakeInference({}), objectStore: memoryObjectStore() });
    const missionId = await mkMission(YORMAN);
    const tokenY = await spotterToken(YORMAN);
    const placeId = await submitAndPhotograph(app, tokenY, missionId, 1);

    const complete = await app.inject({
      method: 'POST',
      url: `/api/spotter/submissions/${placeId}/complete`,
      headers: { authorization: `Bearer ${tokenY}` },
    });
    expect(complete.statusCode).toBe(200);
    const verdict = complete.json() as { decision: string; reasons: string[] };
    expect(verdict.decision).toBe('rejected');
    expect(verdict.reasons).toContain('TOO_FEW_PHOTOS');

    const place = await pool.query(`select verification_status from places where id = $1`, [placeId]);
    expect(place.rows[0]!.verification_status).toBe('rejected');
    const mission = await pool.query(`select status, result_place_id from missions where id = $1`, [missionId]);
    expect(mission.rows[0]).toMatchObject({ status: 'accepted', result_place_id: null });
    await app.close();
  });

  it('a tourist token cannot touch spotter routes', async () => {
    const app = buildApp({ pool, inference: new FakeInference({}), objectStore: memoryObjectStore() });
    const touristToken = await new SignJWT({ sub: YORMAN, role: 'tourist' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(SECRET);
    const res = await app.inject({
      method: 'GET',
      url: '/api/spotter/missions',
      headers: { authorization: `Bearer ${touristToken}` },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });
});
