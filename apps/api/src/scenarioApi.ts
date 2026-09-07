import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  CreateStayReservationRequestSchema,
  ObservationKind,
  observationIsCurrent,
  type PlaceObservation,
  type Reservation,
  type Stay,
} from '@guaca/shared';
import {
  commissionMission,
  currentObservations,
  missionsOnSpotterMap,
  observationsForPlace,
  rewardBalance,
  stayNights,
  storePhoto,
  StayInventoryError,
  type ObservationRow,
} from '@guaca/db';
import type { Inference } from '@guaca/agents';
import { answerSpotterAsk } from './spotterAsk.js';
import type { EmailSender } from './email.js';
import type { ObjectStore } from './objectStore.js';
import { verifyTouristToken } from './touristAuth.js';
import { verifySpotterToken } from './spotterAuth.js';
import {
  merchantLogin,
  requestMerchantCode,
  verifyMerchantToken,
  type MerchantAuthDb,
} from './merchantAuth.js';
import {
  cancelStayReservation,
  confirmStayReservation,
  createStayReservation,
  dateOnly,
  declineStayReservation,
  expireStaleHolds,
  getReservation,
  isoDate,
  listMerchantReservations,
  listTouristReservations,
  loadStay,
  mapReservation,
  ReservationError,
  reservationCopy,
  RESERVATION_STATUS_LABEL,
  venueLocalDate,
} from './reservationService.js';
import {
  creditMissionLedgerOnce,
  getRedemption,
  listCatalog,
  listLedger,
  redeemCatalogItem,
  RewardError,
} from './rewardService.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const CHECK_REWARD_POINTS = 150;
const LUCIA_EMAIL = 'lucia@scenario.guaca.live';

export interface ScenarioApiDeps {
  pool: Pool;
  objectStore: ObjectStore;
  emailSender: EmailSender;
  sessionSecret: () => Uint8Array;
  tokenFrom: (req: FastifyRequest, cookieName: string) => string | undefined;
  sessionCookie: () => {
    httpOnly: boolean;
    sameSite: 'lax';
    secure: boolean;
    path: string;
  };
  codeLimiter: (key: string) => boolean;
  inference?: Inference;
}

function badId(reply: FastifyReply) {
  return reply.code(400).send({ error: 'bad id' });
}

function mapStay(r: Record<string, unknown>): Stay {
  return {
    id: r.id as string,
    placeId: r.place_id as string,
    merchantId: (r.merchant_id as string | null) ?? null,
    roomTypeEn: r.room_type_en as string,
    roomTypeEs: r.room_type_es as string,
    amenities: (r.amenities as string[]) ?? [],
    currency: r.currency as string,
    nightlyPriceMinor: Number(r.nightly_price_minor),
    guestsMax: Number(r.guests_max),
    timezone: r.timezone as string,
  };
}

function mapObservation(row: ObservationRow, nowIso: string): PlaceObservation & { current: boolean } {
  const mapped: PlaceObservation = {
    id: row.id,
    placeId: row.placeId,
    kind: row.kind as PlaceObservation['kind'],
    statementEn: row.statementEn,
    statementEs: row.statementEs,
    sourceKind: row.sourceKind as PlaceObservation['sourceKind'],
    sourceLabel: row.sourceLabel,
    observedAt: row.observedAt.toISOString(),
    validUntil: row.validUntil ? row.validUntil.toISOString() : null,
    status: row.status as PlaceObservation['status'],
    evidencePhotoUrl: row.evidencePhotoUrl,
    createdBy: row.createdBy,
  };
  return { ...mapped, current: observationIsCurrent(mapped, nowIso) };
}

async function sweepExpiredObservations(pool: Pool, placeId?: string): Promise<void> {
  await pool.query(
    `update place_observations
        set status = 'expired'
      where status = 'active'
        and valid_until is not null
        and valid_until <= now()
        and ($1::uuid is null or place_id = $1)`,
    [placeId ?? null],
  );
}

function publicStay(row: Record<string, unknown>) {
  const visibility = (row.visibility as string | null) ?? null;
  return {
    ...mapStay(row),
    name: row.name as string,
    areaId: row.area_id as string,
    category: row.category as string,
    lat: Number(row.lat),
    lon: Number(row.lon),
    priceBand: row.price_band == null ? null : Number(row.price_band),
    publicProfile: row.public_profile ?? null,
    verificationStatus: row.verification_status as string,
    witnessCount: Number(row.witness_count ?? 0),
    bookable: row.merchant_id != null,
    placement: visibility === 'promoted' ? 'promoted' : visibility === 'standard' ? 'standard' : null,
    placementLabel:
      visibility === 'promoted'
        ? { en: 'Promoted', es: 'Promocionado' }
        : visibility === 'standard'
          ? { en: 'Standard', es: 'Estándar' }
          : null,
  };
}

const STAY_SELECT = `select s.id, s.place_id, s.merchant_id, s.room_type_en, s.room_type_es,
            s.amenities, s.currency, s.nightly_price_minor, s.guests_max, s.timezone,
            p.name, p.area_id, p.category, p.price_band, p.public_profile,
            p.verification_status, p.witness_count,
            ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon,
            l.visibility
       from stays s
       join places p on p.id = s.place_id
       left join merchant_zone_licenses l
         on l.stay_id = s.id and l.status = 'active'`;

export function registerScenarioApi(app: FastifyInstance, deps: ScenarioApiDeps): void {
  // Read-only identity handshake: the rehearsal must not reset one database
  // while driving actions against another API. Never expose it in production.
  app.get('/api/recording/runtime', async (_req, reply) => {
    if (process.env.NODE_ENV === 'production' || process.env.RECORDING_SCENARIO_ENABLED !== 'true') {
      return reply.code(404).send({ error: 'not found' });
    }
    const target = await deps.pool.query<{ name: string }>('select current_database() as name');
    const database = target.rows[0]?.name ?? '';
    if (!/^guaca_recording(?:_[a-z0-9]+)*$/.test(database)) {
      return reply.code(409).send({ error: 'recording database required' });
    }
    return { database };
  });
  const { pool, objectStore, emailSender, sessionSecret, tokenFrom, sessionCookie, codeLimiter } = deps;

  const requireTourist = async (req: FastifyRequest, reply: FastifyReply): Promise<string | null> => {
    const token = tokenFrom(req, 'guaca_tourist');
    if (!token) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    const { touristId } = await verifyTouristToken(token, sessionSecret());
    if (!touristId) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    return touristId;
  };

  const requireSpotter = async (req: FastifyRequest, reply: FastifyReply): Promise<string | null> => {
    const token = tokenFrom(req, 'guaca_spotter');
    if (!token) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    const { spotterId } = await verifySpotterToken(token, sessionSecret());
    if (!spotterId) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    return spotterId;
  };

  app.post('/api/spotter/ask', async (req, reply) => {
    if (process.env.NODE_ENV === 'production' || process.env.RECORDING_SCENARIO_ENABLED !== 'true') {
      return reply.code(404).send({ error: 'not found' });
    }
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const body = req.body as { text?: string; language?: string };
    if (!body.text || typeof body.text !== 'string' || body.text.trim().length < 2) {
      return reply.code(400).send({ error: 'text is required' });
    }
    const missions = await missionsOnSpotterMap(pool, spotterId);
    const lang = body.language === 'es' ? 'es' : 'en';
    return answerSpotterAsk(missions, body.text.trim().slice(0, 280), lang, deps.inference);
  });

  const requireMerchant = async (req: FastifyRequest, reply: FastifyReply): Promise<string | null> => {
    const token = tokenFrom(req, 'guaca_merchant');
    if (!token) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    const { merchantId } = await verifyMerchantToken(token, sessionSecret());
    if (!merchantId) {
      reply.code(401).send({ error: 'unauthorized' });
      return null;
    }
    return merchantId;
  };

  const merchantDb: MerchantAuthDb = {
    async findByEmail(email) {
      const res = await pool.query(
        `select id, email, name, language, login_code_hash, login_code_expires_at
           from merchant_accounts where email = $1`,
        [email],
      );
      const r = res.rows[0];
      if (!r) return null;
      return {
        id: r.id as string,
        email: r.email as string,
        name: r.name as string,
        language: r.language as string,
        loginCodeHash: (r.login_code_hash as string | null) ?? null,
        loginCodeExpiresAt: (r.login_code_expires_at as Date | null) ?? null,
      };
    },
    async setLoginCode(email, codeHash, expiresAt) {
      await pool.query(
        `update merchant_accounts
            set login_code_hash = $2, login_code_expires_at = $3
          where email = $1`,
        [email, codeHash, expiresAt],
      );
    },
    async clearLoginCode(merchantId) {
      await pool.query(
        `update merchant_accounts
            set login_code_hash = null, login_code_expires_at = null
          where id = $1`,
        [merchantId],
      );
    },
  };

  async function membershipFor(merchantId: string) {
    const res = await pool.query(
      `select id, merchant_id, stay_id, place_id, role
         from merchant_memberships where merchant_id = $1`,
      [merchantId],
    );
    return res.rows.map((r) => ({
      id: r.id as string,
      merchantId: r.merchant_id as string,
      stayId: r.stay_id as string,
      placeId: r.place_id as string,
      role: r.role as 'owner' | 'staff',
    }));
  }

  async function ownedStayId(merchantId: string, reply: FastifyReply): Promise<string | null> {
    const memberships = await membershipFor(merchantId);
    const stayId = memberships[0]?.stayId;
    if (!stayId) {
      reply.code(403).send({ error: 'no stay membership' });
      return null;
    }
    return stayId;
  }

  function sendReservation(reservation: Reservation) {
    return {
      reservation,
      statusLabel: RESERVATION_STATUS_LABEL[reservation.status],
      copy: reservationCopy(reservation.status),
    };
  }

  function handleReservationErr(err: unknown, reply: FastifyReply) {
    if (err instanceof ReservationError) {
      return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
    }
    if (err instanceof StayInventoryError) {
      const status = err.code === 'UNAVAILABLE' ? 409 : 400;
      return reply.code(status).send({ error: err.code, message: err.message });
    }
    throw err;
  }

  app.get('/api/stays', async (req) => {
    const q = req.query as { areaId?: string; priceBand?: string; amenities?: string };
    const areaId = q.areaId && UUID_RE.test(q.areaId) ? q.areaId : null;
    const priceBand = q.priceBand && /^\d+$/.test(q.priceBand) ? Number(q.priceBand) : null;
    const amenities = q.amenities
      ? q.amenities.split(',').map((s) => s.trim()).filter(Boolean)
      : null;
    const res = await pool.query(
      `${STAY_SELECT}
        where ($1::uuid is null or p.area_id = $1)
          and ($2::int is null or p.price_band = $2)
          and ($3::text[] is null or s.amenities @> $3)
        order by p.price_band nulls last, s.nightly_price_minor, s.id`,
      [areaId, priceBand, amenities],
    );
    return { stays: res.rows.map((row) => publicStay(row as Record<string, unknown>)) };
  });

  app.get('/api/stays/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const res = await pool.query(`${STAY_SELECT} where s.id = $1`, [id]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    return publicStay(row);
  });

  app.get('/api/stays/:id/availability', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const q = req.query as { checkIn?: string; checkOut?: string; guests?: string };
    if (!q.checkIn || !q.checkOut || !DATE_RE.test(q.checkIn) || !DATE_RE.test(q.checkOut)) {
      return reply.code(400).send({ error: 'checkIn and checkOut (YYYY-MM-DD) are required' });
    }
    const guests = q.guests ? Number(q.guests) : 1;
    if (!Number.isInteger(guests) || guests < 1 || guests > 12) {
      return reply.code(400).send({ error: 'guests must be 1-12' });
    }
    const stay = await loadStay(pool, id);
    if (!stay) return reply.code(404).send({ error: 'not found' });
    await expireStaleHolds(pool, id);
    let nights: string[];
    try {
      nights = stayNights(q.checkIn, q.checkOut);
    } catch (err) {
      if (err instanceof StayInventoryError) {
        return reply.code(400).send({ error: err.code, message: err.message });
      }
      throw err;
    }
    const inv = await pool.query<{ night_date: Date | string; allotment: number; reserved_count: number }>(
      `select night_date, allotment, reserved_count
         from stay_inventory
        where stay_id = $1 and night_date >= $2::date and night_date < $3::date
        order by night_date`,
      [id, q.checkIn, q.checkOut],
    );
    const byDate = new Map(
      inv.rows.map((r) => [
        dateOnly(r.night_date),
        { allotment: Number(r.allotment), reservedCount: Number(r.reserved_count) },
      ]),
    );
    const nightViews = nights.map((night) => {
      const row = byDate.get(night);
      const remaining = row ? Math.max(0, row.allotment - row.reservedCount) : 0;
      return {
        date: night,
        allotment: row?.allotment ?? 0,
        reservedCount: row?.reservedCount ?? 0,
        remaining,
        available: Boolean(row && remaining > 0),
      };
    });
    const guestsOk = guests <= stay.guestsMax;
    const nightsOk = nightViews.length > 0 && nightViews.every((n) => n.available);
    const today = venueLocalDate(stay.timezone);
    const datesOk = q.checkIn >= today;
    return {
      stayId: id,
      checkIn: q.checkIn,
      checkOut: q.checkOut,
      guests,
      guestsMax: stay.guestsMax,
      timezone: stay.timezone,
      nightlyPriceMinor: stay.nightlyPriceMinor,
      currency: stay.currency,
      available: stay.merchantId != null && guestsOk && nightsOk && datesOk,
      reason: stay.merchantId == null
        ? 'NOT_BOOKABLE'
        : !datesOk
          ? 'PAST_CHECK_IN'
          : !guestsOk
            ? 'GUESTS'
            : !nightsOk
              ? 'UNAVAILABLE'
              : null,
      nights: nightViews,
    };
  });

  app.post('/api/stays/:id/reservations', async (req, reply) => {
    const touristId = await requireTourist(req, reply);
    if (!touristId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const parsed = CreateStayReservationRequestSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid reservation request', details: parsed.error.flatten() });
    }
    try {
      const reservation = await createStayReservation(pool, {
        stayId: id,
        touristId,
        checkIn: parsed.data.checkIn,
        checkOut: parsed.data.checkOut,
        guests: parsed.data.guests,
        idempotencyKey: parsed.data.idempotencyKey,
        ...(parsed.data.note ? { note: parsed.data.note } : {}),
      });
      return reply.code(201).send(sendReservation(reservation));
    } catch (err) {
      return handleReservationErr(err, reply);
    }
  });

  app.get('/api/tourist/reservations', async (req, reply) => {
    const touristId = await requireTourist(req, reply);
    if (!touristId) return reply;
    const reservations = await listTouristReservations(pool, touristId);
    return {
      reservations: reservations.map((reservation) => ({
        ...sendReservation(reservation),
      })),
    };
  });

  app.get('/api/tourist/reservations/:id', async (req, reply) => {
    const touristId = await requireTourist(req, reply);
    if (!touristId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    await expireStaleHolds(pool);
    const reservation = await getReservation(pool, id);
    if (!reservation || reservation.touristId !== touristId) {
      return reply.code(404).send({ error: 'not found' });
    }
    return sendReservation(reservation);
  });

  app.post('/api/tourist/reservations/:id/cancel', async (req, reply) => {
    const touristId = await requireTourist(req, reply);
    if (!touristId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    try {
      const reservation = await cancelStayReservation(pool, { reservationId: id, touristId });
      return sendReservation(reservation);
    } catch (err) {
      return handleReservationErr(err, reply);
    }
  });

  app.get('/api/tourist/entitlement', async (req, reply) => {
    const touristId = await requireTourist(req, reply);
    if (!touristId) return reply;
    const res = await pool.query(
      `select tourist_id, plan_code, status, starts_at, ends_at, source
         from tourist_entitlements where tourist_id = $1`,
      [touristId],
    );
    const row = res.rows[0];
    if (!row) return reply.code(404).send({ error: 'no entitlement' });
    return {
      touristId: row.tourist_id as string,
      planCode: row.plan_code as string,
      status: row.status as string,
      startsAt: isoDate(row.starts_at as Date)!,
      endsAt: isoDate(row.ends_at as Date | null),
      source: row.source as string,
    };
  });

  app.get('/api/activities', async (req) => {
    const { areaId } = req.query as { areaId?: string };
    const area = areaId && UUID_RE.test(areaId) ? areaId : null;
    const res = await pool.query(
      `select id, area_id, slug, title_en, title_es, summary_en, summary_es,
              cover_image, place_ids, category, estimated_duration_min,
              travel_mode, interest_tags, suggested_window
         from activities
        where ($1::uuid is null or area_id = $1)
        order by title_en, id`,
      [area],
    );
    return { activities: res.rows.map(mapActivity) };
  });

  app.get('/api/activities/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const res = await pool.query(
      `select id, area_id, slug, title_en, title_es, summary_en, summary_es,
              cover_image, place_ids, category, estimated_duration_min,
              travel_mode, interest_tags, suggested_window
         from activities where id = $1`,
      [id],
    );
    const row = res.rows[0];
    if (!row) return reply.code(404).send({ error: 'not found' });
    return mapActivity(row);
  });

  app.get('/api/places/:id/observations', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const place = await pool.query(`select id from places where id = $1`, [id]);
    if (!place.rows[0]) return reply.code(404).send({ error: 'not found' });
    await sweepExpiredObservations(pool, id);
    const nowIso = new Date().toISOString();
    const all = await observationsForPlace(pool, id);
    const live = await currentObservations(pool, id);
    return {
      observations: all.map((row) => mapObservation(row, nowIso)),
      current: live.map((row) => mapObservation(row, nowIso)),
    };
  });

  app.get('/api/observations/:id/photo', async (req, reply) => {
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const row = await pool.query<{ evidence_photo_url: string | null }>(
      `select evidence_photo_url from place_observations where id = $1`,
      [id],
    );
    const key = row.rows[0]?.evidence_photo_url;
    if (!key) return reply.code(404).send({ error: 'not found' });
    const bytes = await objectStore.get(key);
    if (!bytes) return reply.code(404).send({ error: 'not found' });
    return reply.header('content-type', 'image/jpeg').header('cache-control', 'public, max-age=3600').send(bytes);
  });

  app.post('/api/places/:id/observations/request-check', async (req, reply) => {
    const touristId = await requireTourist(req, reply);
    if (!touristId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    await sweepExpiredObservations(pool, id);
    const placeRes = await pool.query<{
      id: string;
      name: string;
      category: string;
      area_id: string;
      h3_8: string;
    }>(
      `select id, name, category, area_id, h3_8 from places where id = $1`,
      [id],
    );
    const place = placeRes.rows[0];
    if (!place) return reply.code(404).send({ error: 'not found' });

    let observation = (
      await pool.query<{ id: string; statement_en: string; statement_es: string }>(
        `select id, statement_en, statement_es from place_observations
          where place_id = $1 and source_kind = 'pending_local_check' and status = 'active'
          order by observed_at desc limit 1`,
        [id],
      )
    ).rows[0];
    if (!observation) {
      const created = await pool.query<{ id: string; statement_en: string; statement_es: string }>(
        `insert into place_observations (
           place_id, kind, statement_en, statement_es, source_kind, source_label,
           observed_at, valid_until, status
         ) values (
           $1, 'condition',
           $2, $3,
           'pending_local_check', 'Pending local check',
           now(), now() + interval '2 days', 'active'
         ) returning id, statement_en, statement_es`,
        [
          id,
          `Local check requested for ${place.name}. This is a pending observation, not a safety claim.`,
          `Comprobación local pedida para ${place.name}. Es una observación pendiente, no una afirmación de seguridad.`,
        ],
      );
      observation = created.rows[0]!;
    }

    const gap = await pool.query<{ id: string }>(
      `insert into gaps (area_id, category, h3_8, question_count, distinct_session_count, status)
       values ($1, $2, $3, 1, 1, 'open')
       on conflict (area_id, category, h3_8)
         do update set updated_at = now(), question_count = gaps.question_count + 1
       returning id`,
      [place.area_id, place.category, place.h3_8],
    );
    const gapId = gap.rows[0]!.id;
    const open = await pool.query<{ id: string; status: string; expires_at: Date }>(
      `select id, status, expires_at from missions
        where gap_id = $1 and status in ('offered','accepted','submitted')
        order by offered_at desc limit 1`,
      [gapId],
    );
    if (open.rows[0]) {
      return {
        status: 'already_open' as const,
        missionId: open.rows[0].id,
        observationId: observation.id,
        expiresAt: open.rows[0].expires_at.toISOString(),
      };
    }

    const lucia = await pool.query<{ id: string }>(
      `select id from spotters where email = $1 and active and area_id = $2`,
      [LUCIA_EMAIL, place.area_id],
    );
    const fallback = lucia.rows[0]
      ? lucia
      : await pool.query<{ id: string }>(
          `select id from spotters where active and area_id = $1 order by level desc, created_at limit 1`,
          [place.area_id],
        );
    const spotterId = fallback.rows[0]?.id;
    if (!spotterId) return reply.code(409).send({ error: 'no_spotter' });

    const commissioned = await commissionMission(pool, {
      gapId,
      spotterId,
      brief: observation.statement_es,
      targetCategory: place.category,
      targetH3: place.h3_8,
      rewardMinor: CHECK_REWARD_POINTS,
      maxRewardMinor: CHECK_REWARD_POINTS,
      dailyCap: 99,
      missionsToday: 0,
      currency: 'USD',
      expiresInHours: 48,
    });
    if (commissioned.status !== 'offered') {
      const again = await pool.query<{ id: string; expires_at: Date }>(
        `select id, expires_at from missions
          where gap_id = $1 and status in ('offered','accepted','submitted')
          order by offered_at desc limit 1`,
        [gapId],
      );
      if (again.rows[0]) {
        return {
          status: 'already_open' as const,
          missionId: again.rows[0].id,
          observationId: observation.id,
          expiresAt: again.rows[0].expires_at.toISOString(),
        };
      }
      return reply.code(409).send({ error: commissioned.status, detail: commissioned.reason });
    }
    await pool.query(`update missions set result_place_id = $1 where id = $2`, [
      place.id,
      commissioned.missionId,
    ]);
    return {
      status: 'commissioned' as const,
      missionId: commissioned.missionId,
      observationId: observation.id,
    };
  });

  app.get('/api/spotter/rewards', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const [balance, entries] = await Promise.all([
      rewardBalance(pool, spotterId),
      listLedger(pool, spotterId),
    ]);
    return { balance, entries, unit: 'points' };
  });

  app.get('/api/spotter/rewards/catalog', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    return { catalog: await listCatalog(pool) };
  });

  app.post('/api/spotter/rewards/redeem', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const body = (req.body ?? {}) as { catalogId?: string };
    if (!body.catalogId || !UUID_RE.test(body.catalogId)) {
      return reply.code(400).send({ error: 'catalogId required' });
    }
    try {
      const redemption = await redeemCatalogItem(pool, { spotterId, catalogId: body.catalogId });
      const balance = await rewardBalance(pool, spotterId);
      return reply.code(201).send({
        redemption,
        balance,
        copy: {
          en: 'Sandbox redemption recorded. Nothing is shipped and points are not money.',
          es: 'Canje de prueba registrado. No se envía nada y los puntos no son dinero.',
        },
      });
    } catch (err) {
      if (err instanceof RewardError) {
        const extra =
          err.code === 'INSUFFICIENT_POINTS'
            ? { balance: await rewardBalance(pool, spotterId) }
            : {};
        return reply.code(err.httpStatus).send({ error: err.code, message: err.message, ...extra });
      }
      throw err;
    }
  });

  app.get('/api/spotter/rewards/redemptions/:id', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    try {
      return { redemption: await getRedemption(pool, id, spotterId) };
    } catch (err) {
      if (err instanceof RewardError) {
        return reply.code(err.httpStatus).send({ error: err.code, message: err.message });
      }
      throw err;
    }
  });

  app.post('/api/spotter/missions/:id/evidence', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const body = (req.body ?? {}) as {
      imageBase64?: string;
      captureLat?: number;
      captureLon?: number;
      captureAccuracyM?: number;
      capturedAt?: string;
    };
    if (!body.imageBase64) return reply.code(400).send({ error: 'imageBase64 required' });
    const mission = await pool.query<{
      id: string;
      status: string;
      spotter_id: string;
      result_place_id: string | null;
    }>(
      `select id, status, spotter_id, result_place_id from missions where id = $1`,
      [id],
    );
    const row = mission.rows[0];
    if (!row || row.spotter_id !== spotterId) return reply.code(404).send({ error: 'mission not found' });
    if (row.status !== 'accepted' && row.status !== 'submitted') {
      return reply.code(409).send({ error: `mission is ${row.status}` });
    }
    if (!row.result_place_id) return reply.code(409).send({ error: 'mission has no place' });
    const observation = await pool.query<{ id: string }>(
      `select id from place_observations
        where place_id = $1 and source_kind = 'pending_local_check' and status = 'active'
        order by observed_at desc limit 1`,
      [row.result_place_id],
    );
    const observationId = observation.rows[0]?.id;
    if (!observationId) return reply.code(409).send({ error: 'no pending observation' });

    const image = Buffer.from(body.imageBase64, 'base64');
    if (image.length === 0 || image.length > 8 * 1024 * 1024) {
      return reply.code(400).send({ error: 'photo must be 1 byte to 8MB' });
    }
    const storageKey = `observations/${observationId}/${randomUUID()}.jpg`;
    await objectStore.put(storageKey, image, 'image/jpeg');
    const capture: { lat?: number; lon?: number; accuracyM?: number; capturedAt?: Date } = {};
    if (typeof body.captureLat === 'number') capture.lat = body.captureLat;
    if (typeof body.captureLon === 'number') capture.lon = body.captureLon;
    if (typeof body.captureAccuracyM === 'number') capture.accuracyM = body.captureAccuracyM;
    if (body.capturedAt) capture.capturedAt = new Date(body.capturedAt);
    await storePhoto(pool, {
      placeId: row.result_place_id,
      uploadedBySpotterId: spotterId,
      storageKey,
      image,
      ...(Object.keys(capture).length > 0 ? { capture } : {}),
    });
    await pool.query(
      `update place_observations
          set evidence_photo_url = $1,
              created_by = $2,
              observed_at = coalesce($3::timestamptz, observed_at)
        where id = $4`,
      [storageKey, spotterId, body.capturedAt ?? null, observationId],
    );
    return {
      ok: true,
      observationId,
      evidencePhotoUrl: `/api/observations/${observationId}/photo`,
      capture: {
        lat: capture.lat ?? null,
        lon: capture.lon ?? null,
        capturedAt: capture.capturedAt ? capture.capturedAt.toISOString() : null,
      },
    };
  });

  app.post('/api/spotter/missions/:id/submit-for-confirmation', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const mission = await pool.query<{
      id: string;
      status: string;
      spotter_id: string;
      result_place_id: string | null;
    }>(
      `select id, status, spotter_id, result_place_id from missions where id = $1`,
      [id],
    );
    const row = mission.rows[0];
    if (!row || row.spotter_id !== spotterId) return reply.code(404).send({ error: 'mission not found' });
    if (row.status === 'submitted') return { ok: true, status: 'submitted' };
    if (row.status !== 'accepted') return reply.code(409).send({ error: `mission is ${row.status}` });
    if (!row.result_place_id) return reply.code(409).send({ error: 'mission has no place' });
    const obs = await pool.query<{ id: string; evidence_photo_url: string | null }>(
      `select id, evidence_photo_url from place_observations
        where place_id = $1 and source_kind = 'pending_local_check' and status = 'active'
        order by observed_at desc limit 1`,
      [row.result_place_id],
    );
    if (!obs.rows[0]?.evidence_photo_url) {
      return reply.code(409).send({ error: 'EVIDENCE_REQUIRED' });
    }
    await pool.query(
      `update missions set status = 'submitted', submitted_at = now()
        where id = $1 and spotter_id = $2 and status = 'accepted'`,
      [id, spotterId],
    );
    return { ok: true, status: 'submitted', observationId: obs.rows[0].id };
  });

  app.post('/api/spotter/missions/:id/confirm', async (req, reply) => {
    const spotterId = await requireSpotter(req, reply);
    if (!spotterId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const client = await pool.connect();
    try {
      await client.query('begin');
      const mission = await client.query<{
        id: string;
        status: string;
        spotter_id: string;
        result_place_id: string | null;
        reward_minor: number;
      }>(
        `select id, status, spotter_id, result_place_id, reward_minor
           from missions where id = $1 for update`,
        [id],
      );
      const row = mission.rows[0];
      if (!row) {
        await client.query('rollback');
        return reply.code(404).send({ error: 'mission not found' });
      }
      if (row.spotter_id === spotterId) {
        await client.query('rollback');
        return reply.code(409).send({ error: 'SELF_CONFIRMATION' });
      }
      if (row.status === 'verified') {
        await client.query('commit');
        const balance = await rewardBalance(pool, row.spotter_id);
        return { ok: true, status: 'verified', alreadyComplete: true, balance };
      }
      if (row.status !== 'submitted') {
        await client.query('rollback');
        return reply.code(409).send({ error: `mission is ${row.status}` });
      }
      if (!row.result_place_id) {
        await client.query('rollback');
        return reply.code(409).send({ error: 'mission has no place' });
      }
      const obs = await client.query<{ id: string }>(
        `select id from place_observations
          where place_id = $1 and source_kind = 'pending_local_check' and status = 'active'
          order by observed_at desc limit 1
          for update`,
        [row.result_place_id],
      );
      const observationId = obs.rows[0]?.id;
      if (!observationId) {
        await client.query('rollback');
        return reply.code(409).send({ error: 'no pending observation' });
      }
      await client.query(
        `update place_observations
            set source_kind = 'locally_confirmed',
                source_label = 'Locally confirmed observation',
                status = 'active'
          where id = $1`,
        [observationId],
      );
      await client.query(
        `update missions set status = 'verified' where id = $1 and status = 'submitted'`,
        [id],
      );
      await client.query(
        `update gaps set status = 'filled', updated_at = now()
          where id = (select gap_id from missions where id = $1)`,
        [id],
      );
      await creditMissionLedgerOnce(client, id);
      await client.query('commit');
      const balance = await rewardBalance(pool, row.spotter_id);
      return {
        ok: true,
        status: 'verified',
        observationId,
        pointsCredited: row.reward_minor,
        submitterBalance: balance,
      };
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  });

  app.post('/api/merchant/auth/request-code', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string };
    const email = body.email?.trim().toLowerCase() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.code(400).send({ error: 'valid email required' });
    }
    if (!codeLimiter(email)) {
      return reply.code(429).send({ error: 'too many codes requested — wait a few minutes' });
    }
    const result = await requestMerchantCode(merchantDb, emailSender, { email });
    if (!result.ok) return reply.code(403).send({ error: 'this email is not registered as a merchant' });
    return { ok: true };
  });

  app.post('/api/merchant/auth/verify', async (req, reply) => {
    const body = (req.body ?? {}) as { email?: string; code?: string };
    if (!body.email || !body.code) return reply.code(400).send({ error: 'email and code required' });
    const result = await merchantLogin(merchantDb, { email: body.email, code: body.code }, sessionSecret());
    if (!result.ok) return reply.code(401).send({ error: result.reason });
    return reply
      .setCookie('guaca_merchant', result.token, { ...sessionCookie(), maxAge: 7 * 24 * 60 * 60 })
      .send({ ok: true, token: result.token, merchant: result.merchant });
  });

  app.post('/api/merchant/logout', async (_req, reply) => {
    return reply.clearCookie('guaca_merchant', sessionCookie()).send({ ok: true });
  });

  app.get('/api/merchant/me', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const account = await pool.query(
      `select id, email, name, language from merchant_accounts where id = $1`,
      [merchantId],
    );
    const row = account.rows[0];
    if (!row) return reply.code(401).send({ error: 'unauthorized' });
    const memberships = await membershipFor(merchantId);
    const stayId = memberships[0]?.stayId ?? null;
    let stay = null;
    if (stayId) {
      const s = await pool.query(`${STAY_SELECT} where s.id = $1`, [stayId]);
      stay = s.rows[0] ? publicStay(s.rows[0] as Record<string, unknown>) : null;
    }
    await expireStaleHolds(pool, stayId ?? undefined);
    const today = stay ? venueLocalDate(stay.timezone) : venueLocalDate('America/Bogota');
    const pending = stayId
      ? await pool.query<{ n: number }>(
          `select count(*)::int as n from reservations
            where stay_id = $1 and status = 'requested'`,
          [stayId],
        )
      : { rows: [{ n: 0 }] };
    const checkIns = stayId
      ? await pool.query(
          `select id, stay_id, merchant_id, tourist_id, check_in, check_out, guests,
                  nightly_price_minor, currency, status, reference_code, hold_expires_at, note
             from reservations
            where stay_id = $1 and check_in = $2::date
              and status in ('requested','confirmed')
            order by created_at`,
          [stayId, today],
        )
      : { rows: [] };
    return {
      merchant: {
        id: row.id as string,
        email: row.email as string,
        name: row.name as string,
        language: row.language as string,
      },
      membership: memberships[0] ?? null,
      stay,
      today: {
        date: today,
        pendingCount: pending.rows[0]?.n ?? 0,
        checkIns: checkIns.rows.map((r) => sendReservation(mapReservation(r as Record<string, unknown>))),
      },
    };
  });

  app.get('/api/merchant/reservations', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const stayId = await ownedStayId(merchantId, reply);
    if (!stayId) return reply;
    const reservations = (await listMerchantReservations(pool, merchantId)).filter(
      (r) => r.stayId === stayId,
    );
    return { reservations: reservations.map((r) => sendReservation(r)) };
  });

  app.post('/api/merchant/reservations/:id/confirm', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    try {
      const reservation = await confirmStayReservation(pool, { reservationId: id, merchantId });
      await pool.query(
        `insert into merchant_actions (merchant_id, stay_id, reservation_id, kind, payload)
         values ($1, $2, $3, 'confirm_reservation', $4::jsonb)`,
        [merchantId, reservation.stayId, reservation.id, JSON.stringify({ referenceCode: reservation.referenceCode })],
      );
      return sendReservation(reservation);
    } catch (err) {
      return handleReservationErr(err, reply);
    }
  });

  app.post('/api/merchant/reservations/:id/decline', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const { id } = req.params as { id: string };
    if (!UUID_RE.test(id)) return badId(reply);
    const body = (req.body ?? {}) as { reason?: string };
    try {
      const reservation = await declineStayReservation(pool, {
        reservationId: id,
        merchantId,
        ...(body.reason ? { reason: body.reason } : {}),
      });
      await pool.query(
        `insert into merchant_actions (merchant_id, stay_id, reservation_id, kind, payload)
         values ($1, $2, $3, 'decline_reservation', $4::jsonb)`,
        [merchantId, reservation.stayId, reservation.id, JSON.stringify({ reason: body.reason ?? null })],
      );
      return sendReservation(reservation);
    } catch (err) {
      return handleReservationErr(err, reply);
    }
  });

  app.get('/api/merchant/stay', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const stayId = await ownedStayId(merchantId, reply);
    if (!stayId) return reply;
    const res = await pool.query(`${STAY_SELECT} where s.id = $1`, [stayId]);
    const row = res.rows[0] as Record<string, unknown> | undefined;
    if (!row) return reply.code(404).send({ error: 'not found' });
    const inv = await pool.query<{ night_date: Date | string; allotment: number; reserved_count: number }>(
      `select night_date, allotment, reserved_count
         from stay_inventory where stay_id = $1 and night_date >= current_date
         order by night_date`,
      [stayId],
    );
    return {
      stay: publicStay(row),
      inventory: inv.rows.map((n) => ({
        date: dateOnly(n.night_date),
        allotment: Number(n.allotment),
        reservedCount: Number(n.reserved_count),
        remaining: Math.max(0, Number(n.allotment) - Number(n.reserved_count)),
      })),
    };
  });

  app.patch('/api/merchant/stay', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const stayId = await ownedStayId(merchantId, reply);
    if (!stayId) return reply;
    const body = (req.body ?? {}) as {
      roomTypeEn?: string;
      roomTypeEs?: string;
      amenities?: string[];
      nightlyPriceMinor?: number;
      guestsMax?: number;
    };
    const stay = await loadStay(pool, stayId);
    if (!stay) return reply.code(404).send({ error: 'not found' });
    const roomTypeEn = body.roomTypeEn?.trim() || stay.roomTypeEn;
    const roomTypeEs = body.roomTypeEs?.trim() || stay.roomTypeEs;
    const amenities = Array.isArray(body.amenities) ? body.amenities : stay.amenities;
    const nightlyPriceMinor =
      typeof body.nightlyPriceMinor === 'number' && body.nightlyPriceMinor >= 0
        ? Math.round(body.nightlyPriceMinor)
        : stay.nightlyPriceMinor;
    const guestsMax =
      typeof body.guestsMax === 'number' && body.guestsMax >= 1
        ? Math.round(body.guestsMax)
        : stay.guestsMax;
    await pool.query(
      `update stays
          set room_type_en = $2, room_type_es = $3, amenities = $4,
              nightly_price_minor = $5, guests_max = $6
        where id = $1`,
      [stayId, roomTypeEn, roomTypeEs, amenities, nightlyPriceMinor, guestsMax],
    );
    if (Array.isArray(body.amenities)) {
      await pool.query(`update places set tags = $2 where id = $1`, [stay.placeId, amenities]);
    }
    await pool.query(
      `insert into merchant_actions (merchant_id, stay_id, kind, payload)
       values ($1, $2, 'edit_profile', $3::jsonb)`,
      [merchantId, stayId, JSON.stringify({ roomTypeEn, roomTypeEs, amenities, nightlyPriceMinor, guestsMax })],
    );
    const res = await pool.query(`${STAY_SELECT} where s.id = $1`, [stayId]);
    return { stay: publicStay(res.rows[0] as Record<string, unknown>) };
  });

  app.patch('/api/merchant/stay/inventory', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const stayId = await ownedStayId(merchantId, reply);
    if (!stayId) return reply;
    const body = (req.body ?? {}) as { nightDate?: string; allotment?: number };
    if (!body.nightDate || !DATE_RE.test(body.nightDate) || typeof body.allotment !== 'number' || body.allotment < 0) {
      return reply.code(400).send({ error: 'nightDate (YYYY-MM-DD) and allotment >= 0 required' });
    }
    const stay = await loadStay(pool, stayId);
    if (!stay) return reply.code(404).send({ error: 'not found' });
    const today = venueLocalDate(stay.timezone);
    if (body.nightDate < today) {
      return reply.code(400).send({ error: 'cannot adjust a past night' });
    }
    const allotment = Math.round(body.allotment);
    const updated = await pool.query(
      `insert into stay_inventory (stay_id, night_date, allotment, reserved_count)
       values ($1, $2::date, $3, 0)
       on conflict (stay_id, night_date) do update
         set allotment = excluded.allotment
       where stay_inventory.reserved_count <= excluded.allotment
       returning night_date, allotment, reserved_count`,
      [stayId, body.nightDate, allotment],
    );
    if (!updated.rows[0]) {
      return reply.code(409).send({ error: 'allotment below reserved count' });
    }
    await pool.query(
      `insert into merchant_actions (merchant_id, stay_id, kind, payload)
       values ($1, $2, 'adjust_inventory', $3::jsonb)`,
      [merchantId, stayId, JSON.stringify({ nightDate: body.nightDate, allotment })],
    );
    const row = updated.rows[0];
    return {
      night: {
        date: dateOnly(row.night_date as Date | string),
        allotment: Number(row.allotment),
        reservedCount: Number(row.reserved_count),
      },
    };
  });

  app.get('/api/merchant/license', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const stayId = await ownedStayId(merchantId, reply);
    if (!stayId) return reply;
    const res = await pool.query(
      `select id, merchant_id, stay_id, area_id, status, visibility,
              label_en, label_es, starts_at, ends_at
         from merchant_zone_licenses
        where merchant_id = $1 and stay_id = $2
        order by case when status = 'active' then 0 else 1 end, starts_at desc
        limit 1`,
      [merchantId, stayId],
    );
    const row = res.rows[0];
    if (!row) return reply.code(404).send({ error: 'no license' });
    await pool.query(
      `insert into merchant_actions (merchant_id, stay_id, kind, payload)
       values ($1, $2, 'inspect_license', $3::jsonb)`,
      [merchantId, stayId, JSON.stringify({ licenseId: row.id })],
    );
    const visibility = row.visibility as 'standard' | 'promoted';
    return {
      id: row.id as string,
      merchantId: row.merchant_id as string,
      stayId: row.stay_id as string,
      areaId: row.area_id as string,
      status: row.status as string,
      visibility,
      promoted: visibility === 'promoted',
      placementLabel:
        visibility === 'promoted'
          ? { en: 'Promoted', es: 'Promocionado' }
          : { en: 'Standard', es: 'Estándar' },
      labelEn: row.label_en as string,
      labelEs: row.label_es as string,
      startsAt: isoDate(row.starts_at as Date)!,
      endsAt: isoDate(row.ends_at as Date | null),
    };
  });

  app.post('/api/merchant/stay/observations', async (req, reply) => {
    const merchantId = await requireMerchant(req, reply);
    if (!merchantId) return reply;
    const memberships = await membershipFor(merchantId);
    const membership = memberships[0];
    if (!membership) return reply.code(403).send({ error: 'no stay membership' });
    const body = (req.body ?? {}) as {
      kind?: string;
      statementEn?: string;
      statementEs?: string;
      validUntil?: string | null;
    };
    const kindParsed = ObservationKind.safeParse(body.kind);
    const statementEn = body.statementEn?.trim() ?? '';
    const statementEs = body.statementEs?.trim() ?? '';
    if (!kindParsed.success || !statementEn || !statementEs) {
      return reply.code(400).send({ error: 'kind, statementEn and statementEs required' });
    }
    const created = await pool.query(
      `insert into place_observations (
         place_id, kind, statement_en, statement_es, source_kind, source_label,
         observed_at, valid_until, status, created_by
       ) values (
         $1, $2, $3, $4, 'business_statement', 'Business statement',
         now(), $5::timestamptz, 'active', null
       ) returning id, place_id, kind, statement_en, statement_es, source_kind,
                   source_label, observed_at, valid_until, status, evidence_photo_url, created_by`,
      [membership.placeId, kindParsed.data, statementEn, statementEs, body.validUntil ?? null],
    );
    await pool.query(
      `insert into merchant_actions (merchant_id, stay_id, kind, payload)
       values ($1, $2, 'publish_update', $3::jsonb)`,
      [merchantId, membership.stayId, JSON.stringify({ observationId: created.rows[0]!.id, kind: kindParsed.data })],
    );
    const nowIso = new Date().toISOString();
    const row = created.rows[0]!;
    return reply.code(201).send({
      observation: mapObservation(
        {
          id: row.id as string,
          placeId: row.place_id as string,
          kind: row.kind as string,
          statementEn: row.statement_en as string,
          statementEs: row.statement_es as string,
          sourceKind: row.source_kind as string,
          sourceLabel: row.source_label as string,
          observedAt: row.observed_at as Date,
          validUntil: (row.valid_until as Date | null) ?? null,
          status: row.status as string,
          evidencePhotoUrl: (row.evidence_photo_url as string | null) ?? null,
          createdBy: (row.created_by as string | null) ?? null,
        },
        nowIso,
      ),
    });
  });
}

function mapActivity(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    areaId: row.area_id as string,
    slug: row.slug as string,
    titleEn: row.title_en as string,
    titleEs: row.title_es as string,
    summaryEn: row.summary_en as string,
    summaryEs: row.summary_es as string,
    coverImage: row.cover_image ?? null,
    placeIds: row.place_ids as string[],
    category: row.category as string,
    estimatedDurationMin: Number(row.estimated_duration_min),
    travelMode: row.travel_mode as string,
    interestTags: row.interest_tags as string[],
    suggestedWindow: (row.suggested_window as string | null) ?? null,
  };
}
