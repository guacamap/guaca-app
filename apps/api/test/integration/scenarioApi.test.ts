import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import pg from 'pg';
import { SignJWT } from 'jose';
import { buildApp } from '../../src/app.ts';
import { authTourist, captureSender } from '../helpers/touristTestAuth.ts';
import { memoryObjectStore } from '../../src/objectStore.ts';
import { migrate, rewardBalance, SCENARIO_CLOCK, SCENARIO_IDS } from '@guaca/db';

const TEST_DB = 'guaca_scenario_api';
const url = (db: string) =>
  (process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca').replace(
    /\/guaca$/,
    '/' + db,
  );
const pool = new pg.Pool({ connectionString: url(TEST_DB) });
const SECRET = new TextEncoder().encode('changeme-32-bytes-min!');
const AREA_ID = '00000000-0000-4000-8000-0000000000ca';
const BEACH_ID = '00000000-0000-4000-8000-00000000ae10';
const MERCHANT_B = '00000000-0000-4000-8000-00000000ad11';
const MEMBERSHIP_B = '00000000-0000-4000-8000-00000000ad12';
const ACTIVITY_ID = SCENARIO_IDS.activities.walledWalk;
const EXPIRED_OBS = '00000000-0000-4000-8000-00000000ae11';

const PHOTO = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../fixtures/front.jpg'),
).toString('base64');

const FEATURED = SCENARIO_IDS.stays.casaBaluarte;
const POSADA = SCENARIO_IDS.stays.posadaReloj;
const CORAL = SCENARIO_IDS.stays.casaCoral;

function datesExclusive(start: string, endExclusive: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${start}T00:00:00Z`);
  const end = new Date(`${endExclusive}T00:00:00Z`);
  while (cursor < end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

async function spotterToken(id: string, name: string): Promise<string> {
  return new SignJWT({ sub: id, name, role: 'spotter' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

async function merchantToken(id: string, name: string): Promise<string> {
  return new SignJWT({ sub: id, name, role: 'merchant' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

async function remaining(stayId: string, night: string): Promise<number> {
  const res = await pool.query<{ remaining: number }>(
    `select (allotment - reserved_count)::int as remaining
       from stay_inventory where stay_id = $1 and night_date = $2::date`,
    [stayId, night],
  );
  return Number(res.rows[0]?.remaining ?? 0);
}

describe('scenario API: stays, merchants, observations, rewards', () => {
  const capture = captureSender();
  let app: ReturnType<typeof buildApp>;
  let luciaAuth: { authorization: string };
  let andresAuth: { authorization: string };
  let elenaAuth: { authorization: string };
  let merchantBAuth: { authorization: string };

  beforeAll(async () => {
    const admin = new pg.Pool({
      connectionString: process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca',
    });
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
          ($1, 'Cartagena', 'cartagena', 'CO', 'America/Bogota',
           ST_GeogFromText('POLYGON((-75.60 10.30,-75.40 10.30,-75.40 10.50,-75.60 10.50,-75.60 10.30))'))`,
        [AREA_ID],
      );

      await client.query(
        `insert into merchant_accounts (id, email, name, language)
         values ($1, 'elena@scenario.guaca.live', 'Elena Vargas', 'es'),
                ($2, 'bruno@scenario.guaca.live', 'Bruno Mesa', 'es')`,
        [SCENARIO_IDS.merchant, MERCHANT_B],
      );

      const stays = [
        {
          placeId: SCENARIO_IDS.places.casaCoral,
          stayId: CORAL,
          name: 'Casa Coral Getsemaní',
          lat: 10.4208,
          lon: -75.5462,
          priceBand: 1,
          price: 4500,
          guests: 2,
          amenities: ['fan', 'wifi'],
          merchantId: null as string | null,
          allotment: 2,
        },
        {
          placeId: SCENARIO_IDS.places.posadaReloj,
          stayId: POSADA,
          name: 'Posada del Reloj',
          lat: 10.4235,
          lon: -75.5505,
          priceBand: 2,
          price: 9000,
          guests: 3,
          amenities: ['ac', 'wifi'],
          merchantId: MERCHANT_B,
          allotment: 2,
        },
        {
          placeId: SCENARIO_IDS.places.casaBaluarte,
          stayId: FEATURED,
          name: 'Casa del Baluarte',
          lat: 10.4278,
          lon: -75.5512,
          priceBand: 3,
          price: 18000,
          guests: 4,
          amenities: ['ac', 'pool', 'wifi'],
          merchantId: SCENARIO_IDS.merchant,
          allotment: 1,
        },
      ];
      for (const stay of stays) {
        await client.query(
          `insert into places (
             id, area_id, name, category, description, landmark_description, location, h3_8,
             price_band, tags, source, verification_status
           )
           values (
             $1, $2, $3, 'lodging', $3, 'Fixture stay',
             ST_SetSRID(ST_MakePoint($4, $5), 4326)::geography,
             h3_lat_lng_to_cell(point($4, $5), 8)::text,
             $6, $7, 'business', 'candidate'
           )`,
          [stay.placeId, AREA_ID, stay.name, stay.lon, stay.lat, stay.priceBand, stay.amenities],
        );
        await client.query(
          `insert into stays (
             id, place_id, merchant_id, room_type_en, room_type_es, amenities,
             currency, nightly_price_minor, guests_max, timezone
           ) values ($1, $2, $3, 'Room', 'Habitación', $4, 'USD', $5, $6, $7)`,
          [
            stay.stayId,
            stay.placeId,
            stay.merchantId,
            stay.amenities,
            stay.price,
            stay.guests,
            SCENARIO_CLOCK.timezone,
          ],
        );
        for (const night of datesExclusive('2026-09-12', '2026-09-26')) {
          const closed = stay.stayId === FEATURED && (night === '2026-09-15' || night === '2026-09-16');
          await client.query(
            `insert into stay_inventory (stay_id, night_date, allotment, reserved_count)
             values ($1, $2::date, $3, 0)`,
            [stay.stayId, night, closed ? 0 : stay.allotment],
          );
        }
      }

      await client.query(
        `insert into merchant_memberships (id, merchant_id, stay_id, place_id, role)
         values ($1, $2, $3, $4, 'owner'), ($5, $6, $7, $8, 'owner')`,
        [
          SCENARIO_IDS.membership,
          SCENARIO_IDS.merchant,
          FEATURED,
          SCENARIO_IDS.places.casaBaluarte,
          MEMBERSHIP_B,
          MERCHANT_B,
          POSADA,
          SCENARIO_IDS.places.posadaReloj,
        ],
      );
      await client.query(
        `insert into merchant_zone_licenses (
           id, merchant_id, stay_id, area_id, status, visibility,
           label_en, label_es, starts_at, ends_at
         ) values ($1, $2, $3, $4, 'active', 'standard', $5, $6, $7::timestamptz, $8::timestamptz)`,
        [
          SCENARIO_IDS.license,
          SCENARIO_IDS.merchant,
          FEATURED,
          AREA_ID,
          'Cartagena Centro Histórico zone license (fixture, not a paid placement)',
          'Licencia de zona del Centro Histórico de Cartagena (fixture, no es una colocación pagada)',
          SCENARIO_CLOCK.instant,
          '2026-12-12T00:00:00-05:00',
        ],
      );

      await client.query(
        `insert into spotters (id, name, email, phone, area_id, home_h3, language)
         values
           ($1, 'Lucía Castañeda', 'lucia@scenario.guaca.live', '+57 300 555 0101', $3,
            h3_lat_lng_to_cell(point(-75.5454, 10.4206), 8)::text, 'es'),
           ($2, 'Andrés Pardo', 'andres@scenario.guaca.live', '+57 300 555 0102', $3,
            h3_lat_lng_to_cell(point(-75.5510, 10.4230), 8)::text, 'es')`,
        [SCENARIO_IDS.spotters.lucia, SCENARIO_IDS.spotters.andres, AREA_ID],
      );

      await client.query(
        `insert into places (
           id, area_id, name, category, landmark_description, location, h3_8,
           source, verification_status
         ) values (
           $1, $2, 'Playa de Marbella', 'beach_water', 'Beach stairs',
           ST_SetSRID(ST_MakePoint(-75.534, 10.428), 4326)::geography,
           h3_lat_lng_to_cell(point(-75.534, 10.428), 8)::text,
           'osm_candidate', 'candidate'
         )`,
        [BEACH_ID, AREA_ID],
      );
      await client.query(
        `insert into place_observations (
           id, place_id, kind, statement_en, statement_es, source_kind, source_label,
           observed_at, valid_until, status
         ) values
           ($1, $2, 'access', 'Pending stairs check', 'Chequeo de escaleras',
            'pending_local_check', 'Pending local check',
            $3::timestamptz, '2026-09-14T23:59:00-05:00', 'active'),
           ($4, $2, 'schedule', 'Old kiosk hours', 'Horario viejo del kiosco',
            'public_listing', 'Public listing',
            '2026-08-01T12:00:00-05:00', '2026-08-10T12:00:00-05:00', 'active')`,
        [SCENARIO_IDS.observation, BEACH_ID, SCENARIO_CLOCK.instant, EXPIRED_OBS],
      );

      await client.query(
        `insert into reward_catalog (
           id, slug, title_en, title_es, description_en, description_es, point_cost, kind
         ) values
           ($1, 'guaca-cap', 'Guaca cap', 'Gorra Guaca', 'Sandbox cap', 'Gorra de prueba', 200, 'cap'),
           ($2, 'guaca-bottle', 'Guaca bottle', 'Botella Guaca', 'Sandbox bottle', 'Botella de prueba', 350, 'bottle'),
           ($3, 'local-experience-voucher', 'Local experience voucher', 'Vale de experiencia local',
            'Sandbox voucher', 'Vale de prueba', 800, 'voucher')`,
        [SCENARIO_IDS.rewards.cap, SCENARIO_IDS.rewards.bottle, SCENARIO_IDS.rewards.voucher],
      );
      await client.query(
        `insert into reward_ledger (id, spotter_id, delta, reason, mission_id, created_at) values
           ($1, $5, 150, 'completed_local_check', null, '2026-08-28T16:00:00-05:00'),
           ($2, $5, 180, 'completed_photo_mission', null, '2026-09-02T11:30:00-05:00'),
           ($3, $5, 120, 'completed_local_check', null, '2026-09-08T18:15:00-05:00'),
           ($4, $6, 80, 'completed_local_check', null, '2026-09-05T10:00:00-05:00')`,
        [
          SCENARIO_IDS.ledger.lucia1,
          SCENARIO_IDS.ledger.lucia2,
          SCENARIO_IDS.ledger.lucia3,
          SCENARIO_IDS.ledger.andres1,
          SCENARIO_IDS.spotters.lucia,
          SCENARIO_IDS.spotters.andres,
        ],
      );

      await client.query(
        `insert into activities (
           id, area_id, slug, title_en, title_es, summary_en, summary_es, cover_image,
           place_ids, category, estimated_duration_min, travel_mode, interest_tags, suggested_window
         ) values (
           $1, $2, 'cartagena-walled-morning', 'Morning in the walled city', 'Mañana en la ciudad amurallada',
           'Walk the walls. Estimated times only.', 'Camina la muralla. Tiempos estimados.',
           $3::jsonb, $4, 'culture_history', 180, 'walk', $5, 'morning'
         )`,
        [
          ACTIVITY_ID,
          AREA_ID,
          JSON.stringify({ url: '/demo/cartagena/torre-del-reloj.jpg' }),
          [SCENARIO_IDS.places.casaBaluarte],
          ['culture'],
        ],
      );
    } finally {
      client.release();
    }

    app = buildApp({
      pool,
      emailSender: capture.sender,
      objectStore: memoryObjectStore(),
    });
    await app.ready();
    luciaAuth = { authorization: `Bearer ${await spotterToken(SCENARIO_IDS.spotters.lucia, 'Lucía')}` };
    andresAuth = { authorization: `Bearer ${await spotterToken(SCENARIO_IDS.spotters.andres, 'Andrés')}` };
    elenaAuth = { authorization: `Bearer ${await merchantToken(SCENARIO_IDS.merchant, 'Elena Vargas')}` };
    merchantBAuth = { authorization: `Bearer ${await merchantToken(MERCHANT_B, 'Bruno Mesa')}` };
  }, 60000);

  afterAll(async () => {
    await app.close();
    await pool.end();
  });

  it('reports profile points and ranking from the reward ledger', async () => {
    const luciaPts = await rewardBalance(pool, SCENARIO_IDS.spotters.lucia);
    const andresPts = await rewardBalance(pool, SCENARIO_IDS.spotters.andres);
    const me = await app.inject({ method: 'GET', url: '/api/spotter/me', headers: luciaAuth });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ totalPoints: luciaPts, rewardBalance: luciaPts });

    const ranking = await app.inject({ method: 'GET', url: '/api/spotter/ranking', headers: luciaAuth });
    expect(ranking.statusCode).toBe(200);
    const body = ranking.json() as {
      ranking: Array<{ id: string; points: number; rank: number }>;
      me: { points: number; rank: number } | null;
    };
    expect(body.me?.points).toBe(luciaPts);
    const luciaRow = body.ranking.find((row) => row.id === SCENARIO_IDS.spotters.lucia);
    const andresRow = body.ranking.find((row) => row.id === SCENARIO_IDS.spotters.andres);
    expect(luciaRow?.points).toBe(luciaPts);
    expect(andresRow?.points).toBe(andresPts);
    expect(luciaRow?.rank).toBeLessThan(andresRow?.rank ?? 99);
  });

  it('lists stays and hides closed nights on the featured bookable stay', async () => {
    const list = await app.inject({ method: 'GET', url: `/api/stays?areaId=${AREA_ID}&priceBand=3` });
    expect(list.statusCode).toBe(200);
    const stays = (list.json() as { stays: Array<{ id: string; bookable: boolean; verificationStatus: string }> }).stays;
    expect(stays).toHaveLength(1);
    expect(stays[0]!.id).toBe(FEATURED);
    expect(stays[0]!.bookable).toBe(true);
    expect(stays[0]!.verificationStatus).toBe('candidate');

    const closed = await app.inject({
      method: 'GET',
      url: `/api/stays/${FEATURED}/availability?checkIn=2026-09-15&checkOut=2026-09-17&guests=2`,
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json()).toMatchObject({ available: false, reason: 'UNAVAILABLE' });

    const open = await app.inject({
      method: 'GET',
      url: `/api/stays/${FEATURED}/availability?checkIn=2026-09-12&checkOut=2026-09-14&guests=2`,
    });
    expect(open.json()).toMatchObject({ available: true, reason: null });
  });

  it('runs request → confirm and never talks about payment', async () => {
    const headers = await authTourist(app, capture.codes, 'guest-confirm@test.guaca.live');
    const created = await app.inject({
      method: 'POST',
      url: `/api/stays/${FEATURED}/reservations`,
      headers,
      payload: {
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
        guests: 2,
        idempotencyKey: 'confirm-key-01',
        note: 'Two nights by the wall',
      },
    });
    expect(created.statusCode).toBe(201);
    const body = created.json() as {
      reservation: { id: string; status: string };
      copy: { en: string };
    };
    expect(body.reservation.status).toBe('requested');
    expect(body.copy.en.toLowerCase()).toContain('awaiting confirmation');
    expect(JSON.stringify(body).toLowerCase()).not.toMatch(/payment successful|payment was taken|paid successfully/);
    expect(await remaining(FEATURED, '2026-09-12')).toBe(0);

    const again = await app.inject({
      method: 'POST',
      url: `/api/stays/${FEATURED}/reservations`,
      headers,
      payload: {
        checkIn: '2026-09-12',
        checkOut: '2026-09-14',
        guests: 2,
        idempotencyKey: 'confirm-key-01',
      },
    });
    expect(again.statusCode).toBe(201);
    expect((again.json() as { reservation: { id: string } }).reservation.id).toBe(body.reservation.id);

    const touristConfirm = await app.inject({
      method: 'POST',
      url: `/api/merchant/reservations/${body.reservation.id}/confirm`,
      headers,
    });
    expect(touristConfirm.statusCode).toBe(401);

    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/merchant/reservations/${body.reservation.id}/confirm`,
      headers: elenaAuth,
    });
    expect(confirmed.statusCode).toBe(200);
    const confirmedBody = confirmed.json() as {
      reservation: { status: string; referenceCode: string };
      copy: { en: string };
    };
    expect(confirmedBody.reservation.status).toBe('confirmed');
    expect(confirmedBody.reservation.referenceCode).toMatch(/^GUA-/);
    expect(confirmedBody.copy.en.toLowerCase()).toContain('confirmed');
    expect(confirmedBody.copy.en.toLowerCase()).not.toMatch(/payment successful/);
    expect(await remaining(FEATURED, '2026-09-12')).toBe(0);

    const viewed = await app.inject({
      method: 'GET',
      url: `/api/tourist/reservations/${body.reservation.id}`,
      headers,
    });
    expect(viewed.statusCode).toBe(200);
    expect((viewed.json() as { reservation: { status: string } }).reservation.status).toBe('confirmed');
  });

  it('releases inventory once on decline, cancel and expiry', async () => {
    const a = await authTourist(app, capture.codes, 'guest-decline@test.guaca.live');
    const declinedReq = await app.inject({
      method: 'POST',
      url: `/api/stays/${FEATURED}/reservations`,
      headers: a,
      payload: { checkIn: '2026-09-17', checkOut: '2026-09-18', guests: 1, idempotencyKey: 'decline-key-01' },
    });
    expect(declinedReq.statusCode).toBe(201);
    expect(await remaining(FEATURED, '2026-09-17')).toBe(0);
    const declinedId = (declinedReq.json() as { reservation: { id: string } }).reservation.id;
    const declined = await app.inject({
      method: 'POST',
      url: `/api/merchant/reservations/${declinedId}/decline`,
      headers: elenaAuth,
      payload: { reason: 'Closed for maintenance' },
    });
    expect(declined.statusCode).toBe(200);
    expect((declined.json() as { reservation: { status: string } }).reservation.status).toBe('declined');
    expect(await remaining(FEATURED, '2026-09-17')).toBe(1);
    const declinedAgain = await app.inject({
      method: 'POST',
      url: `/api/merchant/reservations/${declinedId}/decline`,
      headers: elenaAuth,
    });
    expect(declinedAgain.statusCode).toBe(409);
    expect(await remaining(FEATURED, '2026-09-17')).toBe(1);

    const b = await authTourist(app, capture.codes, 'guest-cancel@test.guaca.live');
    const cancelReq = await app.inject({
      method: 'POST',
      url: `/api/stays/${FEATURED}/reservations`,
      headers: b,
      payload: { checkIn: '2026-09-18', checkOut: '2026-09-19', guests: 1, idempotencyKey: 'cancel-key-01' },
    });
    const cancelId = (cancelReq.json() as { reservation: { id: string } }).reservation.id;
    expect(await remaining(FEATURED, '2026-09-18')).toBe(0);
    const cancelled = await app.inject({
      method: 'POST',
      url: `/api/tourist/reservations/${cancelId}/cancel`,
      headers: b,
    });
    expect(cancelled.statusCode).toBe(200);
    expect(await remaining(FEATURED, '2026-09-18')).toBe(1);
    const cancelledAgain = await app.inject({
      method: 'POST',
      url: `/api/tourist/reservations/${cancelId}/cancel`,
      headers: b,
    });
    expect(cancelledAgain.statusCode).toBe(409);
    expect(await remaining(FEATURED, '2026-09-18')).toBe(1);

    const c = await authTourist(app, capture.codes, 'guest-expire@test.guaca.live');
    const expireReq = await app.inject({
      method: 'POST',
      url: `/api/stays/${FEATURED}/reservations`,
      headers: c,
      payload: { checkIn: '2026-09-19', checkOut: '2026-09-20', guests: 1, idempotencyKey: 'expire-key-01' },
    });
    const expireId = (expireReq.json() as { reservation: { id: string } }).reservation.id;
    expect(await remaining(FEATURED, '2026-09-19')).toBe(0);
    await pool.query(
      `update reservations set hold_expires_at = now() - interval '1 minute' where id = $1`,
      [expireId],
    );
    const listed = await app.inject({ method: 'GET', url: '/api/tourist/reservations', headers: c });
    expect(listed.statusCode).toBe(200);
    const expired = (
      listed.json() as { reservations: Array<{ reservation: { id: string; status: string } }> }
    ).reservations.find((row) => row.reservation.id === expireId);
    expect(expired?.reservation.status).toBe('expired');
    expect(await remaining(FEATURED, '2026-09-19')).toBe(1);
  });

  it('rejects a last-room double book from two parallel requests', async () => {
    const t1 = await authTourist(app, capture.codes, 'race-one@test.guaca.live');
    const t2 = await authTourist(app, capture.codes, 'race-two@test.guaca.live');
    const payload = { checkIn: '2026-09-20', checkOut: '2026-09-21', guests: 1 };
    const [a, b] = await Promise.all([
      app.inject({
        method: 'POST',
        url: `/api/stays/${FEATURED}/reservations`,
        headers: t1,
        payload: { ...payload, idempotencyKey: 'race-key-one' },
      }),
      app.inject({
        method: 'POST',
        url: `/api/stays/${FEATURED}/reservations`,
        headers: t2,
        payload: { ...payload, idempotencyKey: 'race-key-two' },
      }),
    ]);
    const codes = [a.statusCode, b.statusCode].sort();
    expect(codes).toEqual([201, 409]);
    const winner = a.statusCode === 201 ? a : b;
    const loser = a.statusCode === 201 ? b : a;
    expect((loser.json() as { error: string }).error).toBe('UNAVAILABLE');
    expect((winner.json() as { reservation: { status: string } }).reservation.status).toBe('requested');
    expect(await remaining(FEATURED, '2026-09-20')).toBe(0);
  });

  it('keeps merchant inboxes membership-scoped', async () => {
    const tourist = await authTourist(app, capture.codes, 'guest-scope@test.guaca.live');
    const created = await app.inject({
      method: 'POST',
      url: `/api/stays/${FEATURED}/reservations`,
      headers: tourist,
      payload: { checkIn: '2026-09-21', checkOut: '2026-09-22', guests: 1, idempotencyKey: 'scope-key-01' },
    });
    const id = (created.json() as { reservation: { id: string } }).reservation.id;

    const elenaInbox = await app.inject({ method: 'GET', url: '/api/merchant/reservations', headers: elenaAuth });
    const brunoInbox = await app.inject({ method: 'GET', url: '/api/merchant/reservations', headers: merchantBAuth });
    const elenaIds = (
      elenaInbox.json() as { reservations: Array<{ reservation: { id: string } }> }
    ).reservations.map((r) => r.reservation.id);
    const brunoIds = (
      brunoInbox.json() as { reservations: Array<{ reservation: { id: string } }> }
    ).reservations.map((r) => r.reservation.id);
    expect(elenaIds).toContain(id);
    expect(brunoIds).not.toContain(id);

    const stolen = await app.inject({
      method: 'POST',
      url: `/api/merchant/reservations/${id}/confirm`,
      headers: merchantBAuth,
    });
    expect(stolen.statusCode).toBe(404);
  });

  it('labels expired observations as not current and supports a local check', async () => {
    const listed = await app.inject({ method: 'GET', url: `/api/places/${BEACH_ID}/observations` });
    expect(listed.statusCode).toBe(200);
    const payload = listed.json() as {
      observations: Array<{ id: string; status: string; current: boolean; sourceKind: string }>;
      current: Array<{ id: string }>;
    };
    const expired = payload.observations.find((o) => o.id === EXPIRED_OBS);
    expect(expired).toMatchObject({ status: 'expired', current: false });
    expect(payload.current.some((o) => o.id === EXPIRED_OBS)).toBe(false);
    expect(payload.current.some((o) => o.id === SCENARIO_IDS.observation)).toBe(true);

    const tourist = await authTourist(app, capture.codes, 'guest-check@test.guaca.live');
    const requested = await app.inject({
      method: 'POST',
      url: `/api/places/${BEACH_ID}/observations/request-check`,
      headers: tourist,
    });
    expect(requested.statusCode).toBe(200);
    const missionId = (requested.json() as { missionId: string }).missionId;

    const accepted = await app.inject({
      method: 'POST',
      url: `/api/spotter/missions/${missionId}/accept`,
      headers: luciaAuth,
    });
    expect(accepted.statusCode).toBe(200);

    const evidence = await app.inject({
      method: 'POST',
      url: `/api/spotter/missions/${missionId}/evidence`,
      headers: luciaAuth,
      payload: {
        imageBase64: PHOTO,
        captureLat: 10.428,
        captureLon: -75.534,
        capturedAt: '2026-09-12T14:05:00-05:00',
      },
    });
    expect(evidence.statusCode).toBe(200);

    const submitted = await app.inject({
      method: 'POST',
      url: `/api/spotter/missions/${missionId}/submit-for-confirmation`,
      headers: luciaAuth,
    });
    expect(submitted.statusCode).toBe(200);

    const self = await app.inject({
      method: 'POST',
      url: `/api/spotter/missions/${missionId}/confirm`,
      headers: luciaAuth,
    });
    expect(self.statusCode).toBe(409);
    expect((self.json() as { error: string }).error).toBe('SELF_CONFIRMATION');

    const before = await rewardBalance(pool, SCENARIO_IDS.spotters.lucia);
    const confirmed = await app.inject({
      method: 'POST',
      url: `/api/spotter/missions/${missionId}/confirm`,
      headers: andresAuth,
    });
    expect(confirmed.statusCode).toBe(200);
    const after = await rewardBalance(pool, SCENARIO_IDS.spotters.lucia);
    expect(after).toBe(before + 150);

    const retry = await app.inject({
      method: 'POST',
      url: `/api/spotter/missions/${missionId}/confirm`,
      headers: andresAuth,
    });
    expect(retry.statusCode).toBe(200);
    expect((retry.json() as { alreadyComplete?: boolean }).alreadyComplete).toBe(true);
    expect(await rewardBalance(pool, SCENARIO_IDS.spotters.lucia)).toBe(after);

    const refreshed = await app.inject({ method: 'GET', url: `/api/places/${BEACH_ID}/observations` });
    const pending = (
      refreshed.json() as { observations: Array<{ id: string; sourceKind: string }> }
    ).observations.find((o) => o.id === SCENARIO_IDS.observation);
    expect(pending?.sourceKind).toBe('locally_confirmed');

    const place = await pool.query<{ verification_status: string; witness_count: number }>(
      `select verification_status, witness_count from places where id = $1`,
      [BEACH_ID],
    );
    expect(place.rows[0]).toMatchObject({ verification_status: 'candidate', witness_count: 0 });
  });

  it('redeems a catalog item and rejects an insufficient balance', async () => {
    const catalog = await app.inject({ method: 'GET', url: '/api/spotter/rewards/catalog', headers: luciaAuth });
    expect(catalog.statusCode).toBe(200);
    const cap = (
      catalog.json() as { catalog: Array<{ id: string; slug: string; pointCost: number }> }
    ).catalog.find((item) => item.slug === 'guaca-cap');
    expect(cap?.pointCost).toBe(200);

    const before = await rewardBalance(pool, SCENARIO_IDS.spotters.lucia);
    const redeemed = await app.inject({
      method: 'POST',
      url: '/api/spotter/rewards/redeem',
      headers: luciaAuth,
      payload: { catalogId: SCENARIO_IDS.rewards.cap },
    });
    expect(redeemed.statusCode).toBe(201);
    const body = redeemed.json() as {
      redemption: { receiptCode: string; pointsSpent: number; id: string };
      balance: number;
      copy: { en: string };
    };
    expect(body.redemption.pointsSpent).toBe(200);
    expect(body.redemption.receiptCode).toMatch(/^RDM-/);
    expect(body.balance).toBe(before - 200);
    expect(body.copy.en.toLowerCase()).toContain('points are not money');

    const receipt = await app.inject({
      method: 'GET',
      url: `/api/spotter/rewards/redemptions/${body.redemption.id}`,
      headers: luciaAuth,
    });
    expect(receipt.statusCode).toBe(200);

    const again = await app.inject({
      method: 'POST',
      url: '/api/spotter/rewards/redeem',
      headers: luciaAuth,
      payload: { catalogId: SCENARIO_IDS.rewards.cap },
    });
    expect(again.statusCode).toBe(409);
    expect((again.json() as { error: string }).error).toBe('ALREADY_REDEEMED');

    const poor = await app.inject({
      method: 'POST',
      url: '/api/spotter/rewards/redeem',
      headers: andresAuth,
      payload: { catalogId: SCENARIO_IDS.rewards.cap },
    });
    expect(poor.statusCode).toBe(409);
    expect((poor.json() as { error: string }).error).toBe('INSUFFICIENT_POINTS');
  });

  it('exposes entitlement, license, activities and a business-sourced update', async () => {
    const tourist = await authTourist(app, capture.codes, 'viajero@guaca.live');
    const me = await app.inject({ method: 'GET', url: '/api/tourist/me', headers: tourist });
    expect(me.statusCode).toBe(200);
    const touristRow = await pool.query<{ id: string }>(
      `select id from tourists where email = 'viajero@guaca.live'`,
    );
    await pool.query(
      `insert into tourist_entitlements (tourist_id, plan_code, status, starts_at, ends_at, source)
       values ($1, 'explorer', 'active', $2::timestamptz, $3::timestamptz, 'scenario_fixture')
       on conflict (tourist_id) do nothing`,
      [touristRow.rows[0]!.id, SCENARIO_CLOCK.instant, '2026-12-12T00:00:00-05:00'],
    );
    const entitlement = await app.inject({ method: 'GET', url: '/api/tourist/entitlement', headers: tourist });
    expect(entitlement.statusCode).toBe(200);
    expect(entitlement.json()).toMatchObject({
      planCode: 'explorer',
      status: 'active',
      source: 'scenario_fixture',
    });

    const license = await app.inject({ method: 'GET', url: '/api/merchant/license', headers: elenaAuth });
    expect(license.statusCode).toBe(200);
    expect(license.json()).toMatchObject({
      visibility: 'standard',
      promoted: false,
    });

    const activities = await app.inject({ method: 'GET', url: `/api/activities?areaId=${AREA_ID}` });
    expect(activities.statusCode).toBe(200);
    expect((activities.json() as { activities: unknown[] }).activities).toHaveLength(1);

    const update = await app.inject({
      method: 'POST',
      url: '/api/merchant/stay/observations',
      headers: elenaAuth,
      payload: {
        kind: 'service',
        statementEn: 'Rooftop breakfast from 8 to 10.',
        statementEs: 'Desayuno en la terraza de 8 a 10.',
      },
    });
    expect(update.statusCode).toBe(201);
    const observation = (update.json() as { observation: { sourceKind: string; current: boolean } }).observation;
    expect(observation.sourceKind).toBe('business_statement');
    expect(observation.current).toBe(true);
    const stayPlace = await pool.query<{ verification_status: string }>(
      `select verification_status from places where id = $1`,
      [SCENARIO_IDS.places.casaBaluarte],
    );
    expect(stayPlace.rows[0]!.verification_status).toBe('candidate');
  });

  it('lets a merchant sign in with an email code', async () => {
    const requested = await app.inject({
      method: 'POST',
      url: '/api/merchant/auth/request-code',
      payload: { email: 'elena@scenario.guaca.live' },
    });
    expect(requested.statusCode).toBe(200);
    const code = capture.codes['elena@scenario.guaca.live'];
    expect(code).toMatch(/^\d{6}$/);
    const verified = await app.inject({
      method: 'POST',
      url: '/api/merchant/auth/verify',
      payload: { email: 'elena@scenario.guaca.live', code },
    });
    expect(verified.statusCode).toBe(200);
    expect((verified.json() as { merchant: { name: string } }).merchant.name).toBe('Elena Vargas');
    const me = await app.inject({
      method: 'GET',
      url: '/api/merchant/me',
      headers: { authorization: `Bearer ${(verified.json() as { token: string }).token}` },
    });
    expect(me.statusCode).toBe(200);
    expect((me.json() as { stay: { id: string } }).stay.id).toBe(FEATURED);
  });
});
