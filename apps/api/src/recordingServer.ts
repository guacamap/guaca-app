/** Isolated API for repeatable scenario rehearsals.
 * Optional text AI; no schedulers, external email, S3, or live vision. */
import { randomBytes } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import pg from 'pg';
import { buildApp } from './app.js';
import { memoryObjectStore } from './objectStore.js';
import { disabledContextProvider } from './context.js';
import { createRecordingInference } from './recordingInference.js';
import { recordingInference } from './aiRecorder.js';

if (process.env.NODE_ENV === 'production') throw new Error('Recording server is refused in production.');
if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to a dedicated guaca_recording database.');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const target = await pool.query<{ name: string }>('select current_database() as name');
if (!/^guaca_recording(?:_[a-z0-9]+)*$/.test(target.rows[0]?.name ?? '')) {
  await pool.end();
  throw new Error('Recording server refuses the working database. Use guaca_recording or guaca_recording_<suffix>.');
}

process.env.RECORDING_SCENARIO_ENABLED = 'true';
process.env.SHOWCASE_ACCESS_ENABLED = 'false';
process.env.SESSION_SECRET = randomBytes(32).toString('hex');
const aiEnabled = process.env.RECORDING_AI_ENABLED === 'true';
const configFile = new URL('../.env', import.meta.url);
// Do not load the working DATABASE_URL or any other service credentials.
const inference = createRecordingInference(
  target.rows[0]!.name,
  process.env,
  aiEnabled && existsSync(configFile) ? readFileSync(configFile, 'utf8') : '',
);
const recordingTraveller = {
  email: 'viajero@guaca.live', name: 'Alejandro Ríos',
  avatarUrl: '/demo/people/alejandro-rios.png', home: 'Valencia, Venezuela',
  bioEn: 'Exploring the Caribbean with my partner. Here for slow mornings, local breakfasts and a good beach.',
  bioEs: 'Explorando el Caribe en pareja. Me gustan las mañanas sin prisa, los desayunos locales y una buena playa.',
};
// This entry point has already verified the disposable database identity.
// Keep a separate Spotter identity: tourist and witness permissions never merge.
const recordingSpotter = await pool.query(
  `insert into spotters (name, email, phone, area_id, home_h3, language, photo_url)
   select $1, $2, '+58 412 000 0199', a.id,
          h3_lat_lng_to_cell(point(ST_X(ST_Centroid(a.geom::geometry)), ST_Y(ST_Centroid(a.geom::geometry))), 8)::text,
          'en', $3
   from areas a where a.slug = 'puerto-cabello'
   on conflict (email) where email is not null do update set name = excluded.name, photo_url = excluded.photo_url, active = true
   returning id`,
  [recordingTraveller.name, recordingTraveller.email, recordingTraveller.avatarUrl],
);
if (recordingSpotter.rowCount !== 1) throw new Error('Seed Puerto Cabello before starting the recording Spotter account.');
const app = buildApp({
  pool,
  recordingTraveller,
  objectStore: memoryObjectStore(),
  emailSender: { mode: 'dev', async sendLoginCode() {} },
  contextProvider: disabledContextProvider(),
  inference: recordingInference(pool, inference, 'recording-text'),
});
const port = Number(process.env.RECORDING_API_PORT ?? 3011);
await app.listen({ host: '127.0.0.1', port });
console.log(`Isolated recording API listening on 127.0.0.1:${port}. Text AI: ${aiEnabled ? 'enabled' : 'disabled'}. Uploads are memory-only; vision, email, external context, and schedulers are disabled.`);
let closing = false;
async function close() {
  if (closing) return;
  closing = true;
  await app.close();
  await pool.end();
}
process.once('SIGINT', () => void close());
process.once('SIGTERM', () => void close());
