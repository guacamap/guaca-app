import { spawn, type ChildProcess } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLocalEnv, requireScenarioId } from './demoArgv.js';
import { ensureRecordingDatabase, RECORDING_DB_RE, recordingDbUrl } from './ensureRecordingDb.js';
import { BEACH_OSM_ID, SCENARIO_IDS } from './seed/scenario.js';
import { resetScenario, ScenarioTargetError } from './seed/scenarioLifecycle.js';
import { formatCheckpoint } from './demoFormat.js';

loadLocalEnv();

const PORT = Number(process.env.RECORDING_API_PORT ?? 3011);
const API = process.env.GUACA_API_URL ?? `http://127.0.0.1:${PORT}`;
const baseUrl = process.env.DATABASE_URL ?? 'postgres://guaca:guaca@localhost:5432/guaca';

async function existingRecordingDatabase(): Promise<string | null> {
  try {
    const res = await fetch(`${API}/api/recording/runtime`, { headers: { accept: 'application/json' } });
    if (!res.ok) return null;
    const body = (await res.json()) as { database?: string };
    if (body.database && RECORDING_DB_RE.test(body.database)) return recordingDbUrl(baseUrl, body.database);
  } catch {
    return null;
  }
  return null;
}

const existingUrl = await existingRecordingDatabase();
const dbUrl = existingUrl ?? await ensureRecordingDatabase(baseUrl);
process.env.DATABASE_URL = dbUrl;
const { pool } = await import('./pool.js');
const TOURIST_EMAIL = 'viajero@guaca.live';
const PHOTO = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../../../apps/api/test/fixtures/front.jpg'),
).toString('base64');

function cookieValue(res: Response, name: string): string | null {
  const cookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(`${name}=`)) return cookie.slice(name.length + 1).split(';')[0] ?? null;
  }
  return null;
}

async function api(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown } = {},
): Promise<{ status: number; json: unknown; res: Response }> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    ...(opts.body === undefined ? {} : { body: JSON.stringify(opts.body) }),
  });
  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try { json = JSON.parse(text); }
    catch { json = { raw: text }; }
  }
  return { status: res.status, json, res };
}

function fail(step: string, status: number, json: unknown): never {
  throw new Error(`${step} failed (${status}): ${JSON.stringify(json)}`);
}

async function tokenFromLogin(
  path: string,
  body: Record<string, unknown>,
  cookieName: string,
): Promise<string> {
  const { status, json, res } = await api('POST', path, { body });
  if (status >= 400) fail(path, status, json);
  const fromBody = (json as { token?: string }).token;
  const token = fromBody ?? cookieValue(res, cookieName);
  if (!token) fail(`${path} (no token)`, status, json);
  return token;
}

async function touristToken(): Promise<string> {
  const requested = await api('POST', '/api/tourist/auth/request-code', { body: { email: TOURIST_EMAIL } });
  if (requested.status >= 400) fail('tourist request-code', requested.status, requested.json);
  const delivery = (requested.json as { delivery?: string }).delivery;
  const code = delivery === 'access-code'
    ? process.env.SHOWCASE_ACCESS_CODE
    : '000000';
  if (!code) throw new Error('SHOWCASE_ACCESS_CODE is required for the showcase tourist.');
  return tokenFromLogin(
    '/api/tourist/auth/verify',
    { email: TOURIST_EMAIL, code },
    'guaca_tourist',
  );
}

async function runPass(pass: number): Promise<void> {
  const tourist = await touristToken();
  const lucia = await tokenFromLogin(
    '/api/spotter/login',
    { email: 'lucia@scenario.guaca.live', code: '000000' },
    'guaca_spotter',
  );
  const andres = await tokenFromLogin(
    '/api/spotter/login',
    { email: 'andres@scenario.guaca.live', code: '000000' },
    'guaca_spotter',
  );
  const elena = await tokenFromLogin(
    '/api/merchant/auth/verify',
    { email: 'elena@scenario.guaca.live', code: '000000' },
    'guaca_merchant',
  );

  const beach = await pool.query<{ id: string; lat: number; lon: number }>(
    `select p.id, ST_Y(p.location::geometry) as lat, ST_X(p.location::geometry) as lon
       from places p join areas a on a.id = p.area_id
      where a.slug = 'cartagena' and p.osm_id = $1`,
    [BEACH_OSM_ID],
  );
  const place = beach.rows[0];
  if (!place) throw new Error('Playa de Marbella is missing. Seed Cartagena before rehearsing.');

  const meBefore = await api('GET', '/api/spotter/me', { token: lucia });
  if (meBefore.status !== 200) fail('spotter me', meBefore.status, meBefore.json);
  const pointsBefore = (meBefore.json as { totalPoints: number; rewardBalance: number }).totalPoints;
  const balanceBefore = (meBefore.json as { rewardBalance: number }).rewardBalance;
  if (pointsBefore !== balanceBefore) {
    throw new Error(`Pass ${pass}: totalPoints ${pointsBefore} != rewardBalance ${balanceBefore}`);
  }

  const ranking = await api('GET', '/api/spotter/ranking', { token: lucia });
  if (ranking.status !== 200) fail('ranking', ranking.status, ranking.json);
  const meRank = (ranking.json as { me: { points: number } | null }).me;
  if (!meRank || meRank.points !== pointsBefore) {
    throw new Error(`Pass ${pass}: ranking points ${meRank?.points ?? 'none'} != ledger ${pointsBefore}`);
  }

  const check = await api('POST', `/api/places/${place.id}/observations/request-check`, { token: tourist });
  if (check.status === 403) fail('request-check (showcase allowlist)', check.status, check.json);
  if (check.status >= 400) fail('request-check', check.status, check.json);
  const missionId = (check.json as { missionId: string }).missionId;
  if (!missionId) fail('request-check (no mission)', check.status, check.json);

  const accepted = await api('POST', `/api/spotter/missions/${missionId}/accept`, { token: lucia });
  if (accepted.status >= 400) fail('accept', accepted.status, accepted.json);

  const evidence = await api('POST', `/api/spotter/missions/${missionId}/evidence`, {
    token: lucia,
    body: {
      imageBase64: PHOTO,
      captureLat: Number(place.lat),
      captureLon: Number(place.lon),
      capturedAt: '2026-09-12T14:05:00-05:00',
    },
  });
  if (evidence.status >= 400) fail('evidence', evidence.status, evidence.json);

  const submitted = await api('POST', `/api/spotter/missions/${missionId}/submit-for-confirmation`, { token: lucia });
  if (submitted.status >= 400) fail('submit', submitted.status, submitted.json);

  const confirmed = await api('POST', `/api/spotter/missions/${missionId}/confirm`, { token: andres });
  if (confirmed.status >= 400) fail('second local confirm', confirmed.status, confirmed.json);

  const obs = await api('GET', `/api/places/${place.id}/observations`);
  const confirmedRow = (
    obs.json as { observations: Array<{ id: string; sourceKind: string }> }
  ).observations.find((row) => row.id === SCENARIO_IDS.observation);
  if (confirmedRow?.sourceKind !== 'locally_confirmed') {
    throw new Error(`Pass ${pass}: observation is ${confirmedRow?.sourceKind ?? 'missing'}, not locally_confirmed`);
  }

  const stay = await api('POST', `/api/stays/${SCENARIO_IDS.stays.casaBaluarte}/reservations`, {
    token: tourist,
    body: {
      checkIn: '2026-09-12',
      checkOut: '2026-09-14',
      guests: 2,
      idempotencyKey: `rehearse-pass-${pass}`,
    },
  });
  if (stay.status === 403) fail('stay request (showcase allowlist)', stay.status, stay.json);
  if (stay.status >= 400) fail('stay request', stay.status, stay.json);
  const reservationId = (stay.json as { reservation: { id: string; status: string } }).reservation.id;
  if ((stay.json as { reservation: { status: string } }).reservation.status !== 'requested') {
    throw new Error(`Pass ${pass}: reservation is not requested`);
  }

  const merchant = await api('POST', `/api/merchant/reservations/${reservationId}/confirm`, { token: elena });
  if (merchant.status >= 400) fail('merchant confirm', merchant.status, merchant.json);

  const seen = await api('GET', `/api/tourist/reservations/${reservationId}`, { token: tourist });
  if (seen.status >= 400) fail('tourist reservation', seen.status, seen.json);
  if ((seen.json as { reservation?: { status: string }; status?: string }).reservation?.status
    !== 'confirmed'
    && (seen.json as { status?: string }).status !== 'confirmed') {
    throw new Error(`Pass ${pass}: tourist did not see confirmed (${JSON.stringify(seen.json)})`);
  }

  const redeem = await api('POST', '/api/spotter/rewards/redeem', {
    token: lucia,
    body: { catalogId: SCENARIO_IDS.rewards.cap },
  });
  if (redeem.status >= 400) fail('redeem cap', redeem.status, redeem.json);

  const meAfter = await api('GET', '/api/spotter/me', { token: lucia });
  const after = meAfter.json as { totalPoints: number; rewardBalance: number };
  if (after.totalPoints !== after.rewardBalance) {
    throw new Error(`Pass ${pass}: totalPoints and rewardBalance diverged after redeem`);
  }
  if (after.totalPoints !== pointsBefore + 150 - 200) {
    throw new Error(`Pass ${pass}: expected ${pointsBefore + 150 - 200} points, got ${after.totalPoints}`);
  }

  console.log(`Pass ${pass}: mission, stay, and sandbox redeem completed.`);
}

async function waitForRecordingApi(database: string, started: ChildProcess | null): Promise<void> {
  const deadline = Date.now() + 20_000;
  let last = '';
  while (Date.now() < deadline) {
    if (started?.exitCode != null) {
      throw new Error(`Recording API exited before listen (${started.exitCode}). ${last} ${recordingLog.join('')}`);
    }
    try {
      const runtime = await api('GET', '/api/recording/runtime');
      if (runtime.status === 200 && (runtime.json as { database?: string }).database === database) return;
      last = `runtime ${runtime.status} ${JSON.stringify(runtime.json)}`;
    } catch (err) {
      last = (err as Error).message;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Recording API at ${API} did not become ready. ${last} ${recordingLog.join('')}`);
}

const recordingLog: string[] = [];

function startRecordingApi(url: string): ChildProcess {
  const here = dirname(fileURLToPath(import.meta.url));
  const apiRoot = join(here, '../../../apps/api');
  const child = spawn('pnpm', ['exec', 'tsx', 'src/recordingServer.ts'], {
    cwd: apiRoot,
    env: {
      ...process.env,
      DATABASE_URL: url,
      RECORDING_API_PORT: String(PORT),
      NODE_ENV: process.env.NODE_ENV === 'production' ? 'development' : (process.env.NODE_ENV ?? 'development'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => { recordingLog.push(chunk); });
  child.stderr?.on('data', (chunk: string) => { recordingLog.push(chunk); });
  return child;
}

let child: ChildProcess | null = null;
try {
  if (process.env.NODE_ENV === 'production') {
    throw new ScenarioTargetError('Scenario rehearsal is refused in production.');
  }
  const scenarioId = requireScenarioId();
  const apiUrl = new URL(API);
  if (apiUrl.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(apiUrl.hostname)) {
    throw new ScenarioTargetError('Rehearsal requires a local HTTP recording API. Remote targets are refused.');
  }
  const target = await pool.query<{ name: string }>('select current_database() as name');
  const database = target.rows[0]?.name;
  if (!database || !/^guaca_recording(?:_[a-z0-9]+)*$/.test(database)) {
    throw new ScenarioTargetError('Rehearsal requires a dedicated guaca_recording database (optional _suffix).');
  }

  const already = await api('GET', '/api/recording/runtime').catch(() => ({ status: 0, json: null, res: null as unknown as Response }));
  if (already.status === 200 && (already.json as { database?: string } | null)?.database === database) {
    // Reuse the isolated recording API already listening. Do not bind 3011 again.
  } else {
    child = startRecordingApi(dbUrl);
    await waitForRecordingApi(database, child);
  }

  for (const pass of [1, 2]) {
    const reset = await resetScenario(pool, scenarioId);
    if (!reset.ok) {
      console.error(formatCheckpoint(reset));
      throw new Error(`Pass ${pass} did not start at the checkpoint.`);
    }
    await runPass(pass);
  }
  const restored = await resetScenario(pool, scenarioId);
  console.log(formatCheckpoint(restored));
  if (!restored.ok) throw new Error('Start checkpoint was not restored after two passes.');
  console.log(`Two consecutive rehearsals of ${scenarioId} completed.`);
} catch (err) {
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  if (child && child.exitCode == null) {
    child.kill('SIGTERM');
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 2000);
      child?.once('exit', () => { clearTimeout(t); resolve(undefined); });
    });
  }
  await pool.end();
}
