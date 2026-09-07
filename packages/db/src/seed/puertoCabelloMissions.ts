import type { Pool } from 'pg';
import { SCENARIO_CLOCK, SCENARIO_IDS } from './scenario.js';

const ALEJANDRO_EMAIL = 'viajero@guaca.live';
const AREA_SLUG = 'puerto-cabello';

export const PC_MISSION_OSM = {
  breakfast: 13588404601, // Casa Rosada
  entrance: 13588404601, // Casa Rosada, different gap category
  beach: 1323862255, // Playa Delfín
  fortin: 203615814, // Fortín Solano
  accepted: 7754397389, // Picua
  witnessA: 5718270282, // Blue Marine
  witnessB: 5241000521, // La Cueva del Mar
  completed: [161501174, 1482081795, 161006207] as const, // Catedral, Teatro, Iglesia Rosario
  unverified: [12166419, 1734748797, 13588404801, 157189923] as const, // Castillo, Monumento, Da Franco, Plaza Flores
};

const EXPIRES = '2026-09-26T18:00:00-04:00';

function observationIdFor(missionId: string): string {
  const map: Record<string, string> = {
    [SCENARIO_IDS.pcMissions.witnessA]: SCENARIO_IDS.pcObservations.witnessA,
    [SCENARIO_IDS.pcMissions.witnessB]: SCENARIO_IDS.pcObservations.witnessB,
    [SCENARIO_IDS.pcMissions.doneCatedral]: SCENARIO_IDS.pcObservations.doneCatedral,
    [SCENARIO_IDS.pcMissions.doneTeatro]: SCENARIO_IDS.pcObservations.doneTeatro,
    [SCENARIO_IDS.pcMissions.doneIglesia]: SCENARIO_IDS.pcObservations.doneIglesia,
  };
  const id = map[missionId];
  if (!id) throw new Error(`No observation fixture for mission ${missionId}`);
  return id;
}

interface MissionSpec {
  id: string;
  gapId: string;
  osmId: number;
  category: string;
  taskKind: 'hours' | 'access' | 'evidence';
  status: 'offered' | 'accepted' | 'submitted' | 'verified';
  owner: 'alejandro' | 'yorman' | 'rafael';
  brief: string;
  evidenceEn: string;
  evidenceEs: string;
  reward: number;
  photoUrl?: string;
  observationEn?: string;
  observationEs?: string;
  acceptedAt?: string;
  submittedAt?: string;
  verifiedAt?: string;
  ledgerId?: string;
}

const MISSIONS: MissionSpec[] = [
  {
    id: SCENARIO_IDS.pcMissions.breakfast,
    gapId: SCENARIO_IDS.pcGaps.breakfast,
    osmId: PC_MISSION_OSM.breakfast,
    category: 'eat_drink',
    taskKind: 'hours',
    status: 'offered',
    owner: 'alejandro',
    brief: 'Confirm whether Casa Rosada is serving breakfast this morning, and until what time.',
    evidenceEn: 'A photo of the breakfast board or the reception hours card, plus the time you were there.',
    evidenceEs: 'Una foto de la pizarra de desayuno o del cartel de horarios en recepción, y la hora a la que estuviste.',
    reward: 120,
  },
  {
    id: SCENARIO_IDS.pcMissions.entrance,
    gapId: SCENARIO_IDS.pcGaps.entrance,
    osmId: PC_MISSION_OSM.entrance,
    category: 'lodging',
    taskKind: 'evidence',
    status: 'offered',
    owner: 'alejandro',
    brief: 'Photograph the street entrance and reception desk at Casa Rosada so a guest can find it from the Malecón.',
    evidenceEn: 'Two photos: the street door from the Malecón, and the reception desk or lobby sign.',
    evidenceEs: 'Dos fotos: la puerta desde el Malecón, y el escritorio de recepción o el letrero del lobby.',
    reward: 110,
  },
  {
    id: SCENARIO_IDS.pcMissions.beach,
    gapId: SCENARIO_IDS.pcGaps.beach,
    osmId: PC_MISSION_OSM.beach,
    category: 'beach_water',
    taskKind: 'access',
    status: 'offered',
    owner: 'alejandro',
    brief: 'Check access and sea conditions at Playa Delfín. Do not claim it is safe to swim.',
    evidenceEn: 'A photo of the way down to the sand and of the water as it looks now.',
    evidenceEs: 'Una foto del acceso a la arena y del agua tal como se ve ahora.',
    reward: 130,
  },
  {
    id: SCENARIO_IDS.pcMissions.fortin,
    gapId: SCENARIO_IDS.pcGaps.fortin,
    osmId: PC_MISSION_OSM.fortin,
    category: 'culture_history',
    taskKind: 'access',
    status: 'offered',
    owner: 'alejandro',
    brief: 'Confirm whether the path up to Fortín Solano is open to visitors today.',
    evidenceEn: 'A photo of the gate or path, and a note if a guard or a chain is blocking it.',
    evidenceEs: 'Una foto de la reja o el camino, y una nota si un guardia o una cadena lo cierra.',
    reward: 140,
  },
  {
    id: SCENARIO_IDS.pcMissions.accepted,
    gapId: SCENARIO_IDS.pcGaps.accepted,
    osmId: PC_MISSION_OSM.accepted,
    category: 'eat_drink',
    taskKind: 'hours',
    status: 'accepted',
    owner: 'alejandro',
    brief: 'Confirm kitchen hours at Picua Seafood & Bar this afternoon.',
    evidenceEn: 'A photo of the hours on the door or a chalkboard, captured on site.',
    evidenceEs: 'Una foto del horario en la puerta o en una pizarra, tomada en el lugar.',
    reward: 100,
    acceptedAt: '2026-09-12T11:40:00-04:00',
  },
  {
    id: SCENARIO_IDS.pcMissions.witnessA,
    gapId: SCENARIO_IDS.pcGaps.witnessA,
    osmId: PC_MISSION_OSM.witnessA,
    category: 'eat_drink',
    taskKind: 'evidence',
    status: 'submitted',
    owner: 'yorman',
    brief: 'Photograph the marina entrance at Blue Marine so a second local can confirm it.',
    evidenceEn: 'Entrance from the marina walkway.',
    evidenceEs: 'La entrada desde el paseo de la marina.',
    reward: 90,
    photoUrl: '/demo/puerto-cabello/blue-marine.jpg',
    observationEn: 'The marina-side door is open and signed. This is a pending local check, not a locally confirmed fact.',
    observationEs: 'La puerta del lado de la marina está abierta y señalizada. Es una comprobación local pendiente, no un hecho confirmado.',
    acceptedAt: '2026-09-12T10:15:00-04:00',
    submittedAt: '2026-09-12T10:42:00-04:00',
  },
  {
    id: SCENARIO_IDS.pcMissions.witnessB,
    gapId: SCENARIO_IDS.pcGaps.witnessB,
    osmId: PC_MISSION_OSM.witnessB,
    category: 'eat_drink',
    taskKind: 'hours',
    status: 'submitted',
    owner: 'rafael',
    brief: 'Read the hours posted at La Cueva del Mar.',
    evidenceEn: 'A readable photo of the hours at the stone entrance.',
    evidenceEs: 'Una foto legible del horario en la entrada de piedra.',
    reward: 90,
    photoUrl: '/demo/puerto-cabello/la-cueva-del-mar.jpg',
    observationEn: 'A hours card is posted at the vaulted entrance. Pending a second local, not a current opening claim.',
    observationEs: 'Hay un cartel de horario en la entrada abovedada. Pendiente de un segundo local, no es un horario vigente.',
    acceptedAt: '2026-09-12T09:50:00-04:00',
    submittedAt: '2026-09-12T10:20:00-04:00',
  },
  {
    id: SCENARIO_IDS.pcMissions.doneCatedral,
    gapId: SCENARIO_IDS.pcGaps.doneCatedral,
    osmId: PC_MISSION_OSM.completed[0],
    category: 'culture_history',
    taskKind: 'evidence',
    status: 'verified',
    owner: 'alejandro',
    brief: 'Photograph the Malecón face of Catedral de San José.',
    evidenceEn: 'The stone facade from the waterfront.',
    evidenceEs: 'La fachada de piedra desde el malecón.',
    reward: 120,
    photoUrl: '/demo/puerto-cabello/catedral-san-jose.jpg',
    observationEn: 'The cathedral facade on the Malecón matches the public listing. Locally confirmed on a prior visit.',
    observationEs: 'La fachada de la catedral en el malecón coincide con la ficha pública. Confirmado en una visita anterior.',
    acceptedAt: '2026-09-08T16:00:00-04:00',
    submittedAt: '2026-09-08T16:25:00-04:00',
    verifiedAt: '2026-09-08T17:10:00-04:00',
    ledgerId: SCENARIO_IDS.pcLedger.done1,
  },
  {
    id: SCENARIO_IDS.pcMissions.doneTeatro,
    gapId: SCENARIO_IDS.pcGaps.doneTeatro,
    osmId: PC_MISSION_OSM.completed[1],
    category: 'culture_history',
    taskKind: 'evidence',
    status: 'verified',
    owner: 'alejandro',
    brief: 'Confirm the Municipal Theatre is still the building next to Plaza Bolívar.',
    evidenceEn: 'The theatre front from the plaza.',
    evidenceEs: 'La fachada del teatro desde la plaza.',
    reward: 120,
    photoUrl: '/demo/puerto-cabello/teatro-municipal.jpg',
    observationEn: 'The Municipal Theatre still occupies the mapped building by Plaza Bolívar. Locally confirmed.',
    observationEs: 'El Teatro Municipal sigue en el edificio cartografiado junto a la Plaza Bolívar. Confirmado localmente.',
    acceptedAt: '2026-09-06T11:00:00-04:00',
    submittedAt: '2026-09-06T11:20:00-04:00',
    verifiedAt: '2026-09-06T12:05:00-04:00',
    ledgerId: SCENARIO_IDS.pcLedger.done2,
  },
  {
    id: SCENARIO_IDS.pcMissions.doneIglesia,
    gapId: SCENARIO_IDS.pcGaps.doneIglesia,
    osmId: PC_MISSION_OSM.completed[2],
    category: 'culture_history',
    taskKind: 'evidence',
    status: 'verified',
    owner: 'alejandro',
    brief: 'Photograph the clock tower of Iglesia del Rosario from Calle Miranda.',
    evidenceEn: 'The white tower closing the street view.',
    evidenceEs: 'La torre blanca que cierra la calle.',
    reward: 120,
    photoUrl: '/demo/puerto-cabello/iglesia-rosario.jpg',
    observationEn: 'The clock tower still closes the view along Calle Miranda. Locally confirmed.',
    observationEs: 'La torre del reloj sigue cerrando la vista de la calle Miranda. Confirmado localmente.',
    acceptedAt: '2026-09-04T15:30:00-04:00',
    submittedAt: '2026-09-04T15:50:00-04:00',
    verifiedAt: '2026-09-04T16:40:00-04:00',
    ledgerId: SCENARIO_IDS.pcLedger.done3,
  },
];

async function upsertSpotter(
  pool: Pool,
  spec: { id: string; name: string; email: string; phone: string; lat: number; lon: number; photoUrl: string | null },
  areaId: string,
): Promise<string> {
  const existing = await pool.query<{ id: string }>(
    `select id from spotters where email = $1 or phone = $2 order by email = $1 desc limit 1`,
    [spec.email, spec.phone],
  );
  if (existing.rows[0]) {
    await pool.query(
      `update spotters set name = $2, photo_url = coalesce(photo_url, $3), active = true, area_id = $4
        where id = $1`,
      [existing.rows[0].id, spec.name, spec.photoUrl, areaId],
    );
    return existing.rows[0].id;
  }
  await pool.query(
    `insert into spotters (id, name, email, phone, area_id, home_h3, language, photo_url)
     values ($1, $2, $3, $4, $5, h3_lat_lng_to_cell(point($6, $7), 8)::text, 'es', $8)`,
    [spec.id, spec.name, spec.email, spec.phone, areaId, spec.lon, spec.lat, spec.photoUrl],
  );
  return spec.id;
}

export async function seedPuertoCabelloMissions(pool: Pool): Promise<number> {
  const area = await pool.query<{ id: string }>(`select id from areas where slug = $1`, [AREA_SLUG]);
  const areaId = area.rows[0]?.id;
  if (!areaId) throw new Error('Seed Puerto Cabello first.');

  const alejandroId = await upsertSpotter(pool, {
    id: SCENARIO_IDS.spotters.alejandro,
    name: 'Alejandro Ríos',
    email: ALEJANDRO_EMAIL,
    phone: '+58 412 000 0199',
    lat: 10.4716,
    lon: -68.0056,
    photoUrl: '/demo/people/alejandro-rios.png',
  }, areaId);
  const yormanId = await upsertSpotter(pool, {
    id: SCENARIO_IDS.spotters.yorman,
    name: 'Yorman Salazar',
    email: 'yorman@demo.guaca.live',
    phone: '+58 412 000 0001',
    lat: 10.4720,
    lon: -68.0070,
    photoUrl: null,
  }, areaId);
  const rafaelId = await upsertSpotter(pool, {
    id: SCENARIO_IDS.spotters.rafael,
    name: 'Rafael Rondón',
    email: 'rafael@demo.guaca.live',
    phone: '+58 412 999 0001',
    lat: 10.4700,
    lon: -68.0060,
    photoUrl: null,
  }, areaId);

  const owners: Record<MissionSpec['owner'], string> = {
    alejandro: alejandroId,
    yorman: yormanId,
    rafael: rafaelId,
  };

  const places = await pool.query<{ id: string; osm_id: string; h3_8: string; lon: number; lat: number }>(
    `select id, osm_id::text, h3_8,
            ST_X(location::geometry) as lon, ST_Y(location::geometry) as lat
       from places
      where area_id = $1 and osm_id = any($2::bigint[])`,
    [areaId, [...new Set(MISSIONS.map((m) => m.osmId))]],
  );
  const byOsm = new Map(places.rows.map((p) => [Number(p.osm_id), p]));

  let inserted = 0;
  let gapIndex = 0;
  for (const spec of MISSIONS) {
    const place = byOsm.get(spec.osmId);
    if (!place) {
      throw new Error(`Puerto Cabello mission place osm ${spec.osmId} is missing. Seed the public catalog first.`);
    }
    const ownerId = owners[spec.owner];
    // Centro listings share one r8 cell. Offset so each fixture gap is unique
    // under gaps_cluster_idx; map pins still use the place point.
    const offset = (gapIndex % 5) * 0.012;
    const north = Math.floor(gapIndex / 5) * 0.012;
    gapIndex += 1;
    const h3 = await pool.query<{ h3: string }>(
      `select h3_lat_lng_to_cell(point($1, $2), 8)::text as h3`,
      [place.lon + offset, place.lat + north],
    );
    const targetH3 = h3.rows[0]?.h3 ?? place.h3_8;
    await pool.query(
      `insert into gaps (id, area_id, category, h3_8, question_count, distinct_session_count, score, status, last_asked_at)
       values ($1, $2, $3, $4, 3, 2, 12, $5, $6::timestamptz)
       on conflict (id) do nothing`,
      [
        spec.gapId,
        areaId,
        spec.category,
        targetH3,
        spec.status === 'verified' ? 'filled' : 'commissioned',
        SCENARIO_CLOCK.instant,
      ],
    );
    const mission = await pool.query(
      `insert into missions (
         id, gap_id, spotter_id, brief, target_category, target_h3, reward_minor, currency,
         status, created_by, result_place_id, offered_at, accepted_at, submitted_at, expires_at, task_kind
       ) values (
         $1, $2, $3, $4, $5, $6, $7, 'USD',
         $8, 'operator', $9, $10::timestamptz, $11::timestamptz, $12::timestamptz, $13::timestamptz, $14
       )
       on conflict (id) do nothing`,
      [
        spec.id,
        spec.gapId,
        ownerId,
        spec.brief,
        spec.category,
        targetH3,
        spec.reward,
        spec.status,
        place.id,
        '2026-09-12T08:00:00-04:00',
        spec.acceptedAt ?? null,
        spec.submittedAt ?? null,
        spec.status === 'verified' ? spec.verifiedAt : EXPIRES,
        spec.taskKind,
      ],
    );
    inserted += mission.rowCount ?? 0;

    if (spec.observationEn && spec.photoUrl) {
      const observationId = observationIdFor(spec.id);
      const sourceKind = spec.status === 'verified' ? 'locally_confirmed' : 'pending_local_check';
      await pool.query(
        `insert into place_observations (
           id, place_id, kind, statement_en, statement_es, source_kind, source_label,
           observed_at, valid_until, status, evidence_photo_url, created_by
         ) values (
           $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz, 'active', $10, $11
         )
         on conflict (id) do nothing`,
        [
          observationId,
          place.id,
          spec.taskKind === 'hours' ? 'schedule' : spec.taskKind === 'access' ? 'access' : 'condition',
          spec.observationEn,
          spec.observationEs,
          sourceKind,
          spec.status === 'verified' ? 'Locally confirmed' : 'Pending local check',
          spec.submittedAt ?? SCENARIO_CLOCK.instant,
          spec.status === 'verified' ? '2026-10-08T00:00:00-04:00' : '2026-09-14T23:59:00-04:00',
          spec.photoUrl,
          ownerId,
        ],
      );
    }

    if (spec.ledgerId && spec.status === 'verified') {
      await pool.query(
        `insert into reward_ledger (id, spotter_id, delta, reason, mission_id, created_at)
         values ($1, $2, $3, 'completed_local_check', $4, $5::timestamptz)
         on conflict (id) do nothing`,
        [spec.ledgerId, ownerId, spec.reward, spec.id, spec.verifiedAt],
      );
    }
  }

  return inserted;
}

export function pcMissionIds(): string[] {
  return Object.values(SCENARIO_IDS.pcMissions);
}

export function pcGapIds(): string[] {
  return Object.values(SCENARIO_IDS.pcGaps);
}

export function pcLedgerIds(): string[] {
  return Object.values(SCENARIO_IDS.pcLedger);
}
