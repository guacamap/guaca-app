import type { Pool } from 'pg';

const AREA_ID = '00000000-0000-4000-8000-00000000000a';

// Hand-drawn walkable zones for the Puerto Cabello pilot (plan §7.5).
const ZONES = [
  { id: 'malecon', name: 'Malecón', access: 0, geom: 'POLYGON((-68.0080 10.4650,-68.0000 10.4650,-68.0000 10.4780,-68.0080 10.4780,-68.0080 10.4650))' },
  { id: 'casco-historico', name: 'Casco Histórico', access: 0, geom: 'POLYGON((-68.0120 10.4700,-68.0040 10.4700,-68.0040 10.4820,-68.0120 10.4820,-68.0120 10.4700))' },
  { id: 'playa-quizandal', name: 'Playa Quizandal', access: 1, geom: 'POLYGON((-68.0060 10.4520,-67.9980 10.4520,-67.9980 10.4620,-68.0060 10.4620,-68.0060 10.4520))' },
  { id: 'borburata', name: 'Borburata', access: 1, geom: 'POLYGON((-68.0200 10.4400,-68.0100 10.4400,-68.0100 10.4500,-68.0200 10.4500,-68.0200 10.4400))' },
  { id: 'patanemo', name: 'Patanemo', access: 2, geom: 'POLYGON((-68.0280 10.4300,-68.0180 10.4300,-68.0180 10.4400,-68.0280 10.4400,-68.0280 10.4300))' },
  { id: 'isla-larga', name: 'Isla Larga', access: 2, geom: 'POLYGON((-68.0000 10.4300,-67.9900 10.4300,-67.9900 10.4400,-68.0000 10.4400,-68.0000 10.4300))' },
  { id: 'centro', name: 'Centro', access: 0, geom: 'POLYGON((-68.0120 10.4650,-68.0040 10.4650,-68.0040 10.4750,-68.0120 10.4750,-68.0120 10.4650))' },
  { id: 'el-trompillo', name: 'El Trompillo', access: 1, geom: 'POLYGON((-68.0160 10.4550,-68.0080 10.4550,-68.0080 10.4650,-68.0160 10.4650,-68.0160 10.4550))' },
  { id: 'san-esteban', name: 'San Esteban', access: 1, geom: 'POLYGON((-68.0240 10.4500,-68.0160 10.4500,-68.0160 10.4600,-68.0240 10.4600,-68.0240 10.4500))' },
  { id: 'la-guaricha', name: 'La Guaricha', access: 0, geom: 'POLYGON((-68.0040 10.4750,-67.9960 10.4750,-67.9960 10.4850,-68.0040 10.4850,-68.0040 10.4750))' },
];

const SPOTTERS = [
  { name: 'Yorman Salazar', phone: '+58 412 000 0001', zone: 'malecon' },
  { name: 'María Fernanda', phone: '+58 412 000 0002', zone: 'casco-historico' },
  { name: 'Carlos Pirela', phone: '+58 412 000 0003', zone: 'playa-quizandal' },
  { name: 'Luisana Contreras', phone: '+58 412 000 0004', zone: 'borburata' },
  { name: 'José Gregorio', phone: '+58 412 000 0005', zone: 'patanemo' },
  { name: 'Ana Karina', phone: '+58 412 000 0006', zone: 'isla-larga' },
  { name: 'Roberto Márquez', phone: '+58 412 000 0007', zone: 'centro' },
  { name: 'Genesis Villalobos', phone: '+58 412 000 0008', zone: 'el-trompillo' },
  { name: 'Daniel Lugo', phone: '+58 412 000 0009', zone: 'san-esteban' },
  { name: 'Paola Marcano', phone: '+58 412 000 0010', zone: 'la-guaricha' },
];

const PROPERTIES = [
  { name: 'Posada La Marina', plan: 'paid', qr: 'qr-marina', lon: -68.0065, lat: 10.4720 },
  { name: 'Villa Quizandal', plan: 'paid', qr: 'qr-quizandal', lon: -68.0020, lat: 10.4570 },
  { name: 'Casa del Puerto', plan: 'free', qr: 'qr-puerto', lon: -68.0090, lat: 10.4760 },
];

/**
 * Seed the pilot: 1 area (Puerto Cabello), walkable zones, 10 curated
 * spotters (one per zone), and 3 properties (2 paid, 1 free) with QR
 * tokens. Idempotent — re-running upserts nothing new.
 */
export interface SeedOptions {
  /** Demo spotters, villas and their QR tokens. NEVER true in production —
   *  they are invented people with fake phone numbers. */
  demo?: boolean;
}

/**
 * `demo: false` (the production default) seeds only the reference geography
 * — the pilot area and its zones — which the loop needs to attribute
 * questions and cluster gaps. Real spotters and villas are added by an
 * operator with `guaca spotter add` / `guaca property add`.
 */
export async function seed(pool: Pool, options: SeedOptions = {}): Promise<void> {
  const demo = options.demo ?? true;
  await pool.query(
    `insert into areas (id, name, slug, country, timezone, geom) values
       ($1, 'Puerto Cabello', 'puerto-cabello', 'VE', 'America/Caracas',
        ST_GeogFromText('POLYGON((-68.03 10.44,-67.98 10.44,-67.98 10.52,-68.03 10.52,-68.03 10.44))'))
     on conflict (id) do nothing`,
    [AREA_ID],
  );

  for (const zone of ZONES) {
    await pool.query(
      `insert into zones (id, area_id, name, geom, access_difficulty) values
         ($1, $2, $3, ST_GeogFromText($4), $5)
       on conflict (id) do nothing`,
      [zone.id, AREA_ID, zone.name, zone.geom, zone.access],
    );
  }

  if (!demo) return;

  for (const s of SPOTTERS) {
    await pool.query(
      `insert into spotters (name, phone, area_id, home_h3, language) values
         ($1, $2, $3, $4, 'es')
       on conflict (phone) do nothing`,
      [s.name, s.phone, AREA_ID, s.zone],
    );
  }

  for (const p of PROPERTIES) {
    await pool.query(
      `insert into properties (name, area_id, location, qr_token, plan, subscription_minor, currency) values
         ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5, $6, $7, 'USD')
       on conflict (qr_token) do nothing`,
      [p.name, AREA_ID, p.lon, p.lat, p.qr, p.plan, p.plan === 'paid' ? 1200 : 0],
    );
  }
}
