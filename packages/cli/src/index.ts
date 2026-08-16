#!/usr/bin/env node
import { Command } from 'commander';
import { requireOperatorToken, render } from './auth.js';

const program = new Command();

program
  .name('guaca')
  .description('GUACA operator CLI — human oversight for the agents')
  .version('0.1.0')
  .option('--json', 'output a single JSON line')
  .hook('preAction', (thisCommand, actionCommand) => {
    // Mutation commands authenticate up front; read-only commands warn.
    const mutating = ['verify', 'commission', 'override', 'pay', 'spotter', 'property', 'posts', 'registrations'];
    const name = actionCommand.name();
    if (mutating.includes(name)) {
      requireOperatorToken(process.env.OPERATOR_TOKEN);
    }
  });

function rootJson(command: { parent: Command | null }): boolean {
  return (command.parent?.opts().json as boolean | undefined) ?? false;
}

async function withPool<T>(fn: (pool: import('pg').Pool) => Promise<T>): Promise<T> {
  const { pool } = await import('@guaca/db');
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

program
  .command('whoami')
  .description('show the operator identity')
  .action((opts, command) => {
    const json = rootJson(command);
    const token = process.env.OPERATOR_TOKEN ? 'authenticated' : 'unauthenticated';
    process.stdout.write(render({ operator: token }, { json }) + '\n');
  });

program
  .command('audit')
  .description('map-health audit — findings + demand-driven mission candidates')
  .argument('[areaId]', 'area to audit (defaults to the first area)')
  .option('--narrative', 'add a model-written analyst note (one inference call)')
  .option('--es', 'narrative in Spanish')
  .action(async (areaId, opts, command) => {
    const json = rootJson(command);
    const { auditCommand, renderAudit } = await import('./commands/audit.js');
    await withPool(async (pool) => {
      const result = await auditCommand(pool, {
        areaId,
        narrative: opts.narrative ?? false,
        language: opts.es ? 'es' : 'en',
      });
      process.stdout.write(renderAudit(result, { json }) + '\n');
    });
  });

program
  .command('gaps')
  .description('ranked coverage gaps with score breakdown')
  .argument('[areaId]')
  .action(async (areaId, opts, command) => {
    const json = rootJson(command);
    const { gapsCommand } = await import('./commands/gaps.js');
    const { rankedGaps, operatorCommission } = await import('@guaca/db');
    await withPool(async (pool) => {
      const rows = await gapsCommand({ rankedGaps, operatorCommission }, pool, areaId);
      process.stdout.write(render(rows, { json }) + '\n');
    });
  });

program
  .command('commission')
  .description('commission ONE mission for a gap — operator path, audited')
  .argument('<gapId>')
  .requiredOption('--spotter <spotterId>', 'assignee — the zone owner first')
  .option('--reward <minor>', 'reward in minor units', '300')
  .option('--approve', 'explicit human approval (required)')
  .action(async (gapId, opts, command) => {
    const json = rootJson(command);
    const { commissionCommand } = await import('./commands/gaps.js');
    const { rankedGaps, operatorCommission } = await import('@guaca/db');
    await withPool(async (pool) => {
      const gap = (await rankedGaps(pool)).find((g) => g.id === gapId);
      const result = await commissionCommand({
        gapId,
        spotterId: opts.spotter,
        rewardMinor: Number(opts.reward),
        approve: opts.approve ?? false,
        ...(gap ? { targetCategory: gap.category, targetH3: gap.h3_8 } : {}),
        db: { rankedGaps, operatorCommission },
        pool,
      });
      process.stdout.write(render(result, { json }) + '\n');
    });
  });

program
  .command('missions')
  .description('list missions')
  .option('--status <status>', 'offered|accepted|submitted|verified|paid|expired|cancelled')
  .action(async (opts, command) => {
    const json = rootJson(command);
    const { missionsCommand } = await import('./commands/missions.js');
    const { listMissions, cancelMission, payMission } = await import('@guaca/db');
    await withPool(async (pool) => {
      const rows = await missionsCommand({ listMissions, cancelMission, payMission }, pool, opts.status);
      process.stdout.write(render(rows, { json }) + '\n');
    });
  });

program
  .command('override')
  .description('cancel a mission — audited')
  .argument('<missionId>')
  .option('--cancel', 'cancel the mission')
  .option('--reason <text>')
  .action(async (missionId, opts, command) => {
    const json = rootJson(command);
    const { overrideCommand } = await import('./commands/missions.js');
    const { listMissions, cancelMission, payMission } = await import('@guaca/db');
    await withPool(async (pool) => {
      const result = await overrideCommand({
        missionId,
        cancel: opts.cancel ?? false,
        reason: opts.reason,
        db: { listMissions, cancelMission, payMission },
        pool,
      });
      process.stdout.write(render(result, { json }) + '\n');
    });
  });

program
  .command('pay')
  .description('pay a verified mission (mock provider, idempotent)')
  .argument('<missionId>')
  .action(async (missionId, opts, command) => {
    const json = rootJson(command);
    const { payCommand } = await import('./commands/missions.js');
    const { listMissions, cancelMission, payMission } = await import('@guaca/db');
    await withPool(async (pool) => {
      const result = await payCommand({
        missionId,
        db: { listMissions, cancelMission, payMission },
        pool,
      });
      process.stdout.write(render(result, { json }) + '\n');
    });
  });

program
  .command('queue')
  .description('verification escalations awaiting a human')
  .action(async (opts, command) => {
    const json = rootJson(command);
    const { queueCommand } = await import('./commands/verify.js');
    const { pendingOperatorQueue, operatorVerify } = await import('@guaca/db');
    await withPool(async (pool) => {
      const rows = await queueCommand(
        {
          pendingOperatorQueue,
          operatorVerify: (runId, decision, operator, note) =>
            operatorVerify(pool, runId, decision, operator, note),
        },
        pool,
      );
      process.stdout.write(render(rows, { json }) + '\n');
    });
  });

program
  .command('verify')
  .description('resolve a queued verification — audited')
  .argument('<runId>')
  .option('--approve')
  .option('--reject')
  .option('--reason <text>')
  .action(async (runId, opts, command) => {
    const json = rootJson(command);
    const { verifyCommand } = await import('./commands/verify.js');
    const { pendingOperatorQueue, operatorVerify } = await import('@guaca/db');
    if (!opts.approve && !opts.reject) {
      process.stdout.write(render({ ok: false, reason: 'pass --approve or --reject' }, { json }) + '\n');
      return;
    }
    await withPool(async (pool) => {
      const result = await verifyCommand({
        id: runId,
        action: opts.approve ? 'APPROVE' : 'REJECT',
        operator: process.env.OPERATOR_TOKEN ?? 'operator',
        reason: opts.reason,
        db: {
          pendingOperatorQueue,
          operatorVerify: (rid, decision, operator, note) =>
            operatorVerify(pool, rid, decision, operator, note),
        },
      });
      process.stdout.write(render(result, { json }) + '\n');
    });
  });

const property = program.command('property').description('villas/posadas — the distribution channel');
property
  .command('add')
  .argument('<name>')
  .requiredOption('--area <areaId>')
  .requiredOption('--lat <lat>')
  .requiredOption('--lon <lon>')
  .option('--plan <plan>', 'free|paid', 'free')
  .option('--subscription <minor>', 'monthly value in minor units (drives gap weighting)', '0')
  .action(async (name, opts, command) => {
    const json = rootJson(command.parent!);
    const { addProperty } = await import('@guaca/db');
    await withPool(async (pool) => {
      const result = await addProperty(pool, {
        name,
        areaId: opts.area,
        lat: Number(opts.lat),
        lon: Number(opts.lon),
        plan: opts.plan === 'paid' ? 'paid' : 'free',
        subscriptionMinor: Number(opts.subscription),
      });
      const card = `card: http://localhost:3002/qr-card/${result.qrToken}`;
      process.stdout.write(render({ ...result, card }, { json }) + '\n');
    });
  });
property
  .command('list')
  .action(async (opts, command) => {
    const json = rootJson(command.parent!);
    const { listProperties } = await import('@guaca/db');
    await withPool(async (pool) => {
      const rows = await listProperties(pool);
      process.stdout.write(render(rows, { json }) + '\n');
    });
  });

const spotter = program.command('spotter').description('curated spotter roster');
spotter
  .command('add')
  .argument('<name>')
  .argument('<phone>')
  .requiredOption('--area <areaId>')
  .option('--photo-url <url>', 'territory identity — the face on their pins')
  .option('--zone <h3>', 'home zone (h3 cell) they own')
  .option('--language <lang>', 'es|en', 'es')
  .action(async (name, phone, opts, command) => {
    const json = rootJson(command.parent!);
    const { spotterAddCommand } = await import('./commands/spotters.js');
    const { addSpotter, listSpotters, issueLoginCode } = await import('@guaca/db');
    await withPool(async (pool) => {
      const result = await spotterAddCommand({
        name, phone, areaId: opts.area,
        language: opts.language, photoUrl: opts.photoUrl, homeH3: opts.zone,
        db: { addSpotter, listSpotters, issueLoginCode }, pool,
      });
      process.stdout.write(render(result, { json }) + '\n');
    });
  });
spotter
  .command('list')
  .action(async (opts, command) => {
    const json = rootJson(command.parent!);
    const { spotterListCommand } = await import('./commands/spotters.js');
    const { addSpotter, listSpotters, issueLoginCode } = await import('@guaca/db');
    await withPool(async (pool) => {
      const rows = await spotterListCommand({ db: { addSpotter, listSpotters, issueLoginCode }, pool });
      process.stdout.write(render(rows, { json }) + '\n');
    });
  });
spotter
  .command('code')
  .argument('<spotterId>')
  .action(async (spotterId, opts, command) => {
    const json = rootJson(command.parent!);
    const { spotterCodeCommand } = await import('./commands/spotters.js');
    const { addSpotter, listSpotters, issueLoginCode } = await import('@guaca/db');
    await withPool(async (pool) => {
      const result = await spotterCodeCommand({
        spotterId, db: { addSpotter, listSpotters, issueLoginCode }, pool,
      });
      process.stdout.write(render(result, { json }) + '\n');
    });
  });

program
  .command('tail')
  .description('live ops stream (Ctrl-C to stop)')
  .option('--agent <agent>')
  .option('--event <event>')
  .action(async (opts) => {
    const { matchesFilters, prettyPrint } = await import('./commands/tail.js');
    const base = process.env.GUACA_API_URL ?? 'http://localhost:3001';
    const url = base.replace(/^http/, 'ws') + '/api/ops/stream';
    const ws = new WebSocket(url);
    ws.onmessage = (ev) => {
      try {
        const line = JSON.parse(String(ev.data));
        if (matchesFilters(line, { agent: opts.agent, event: opts.event })) {
          process.stdout.write(prettyPrint(line) + '\n');
        }
      } catch {
        process.stdout.write(String(ev.data) + '\n');
      }
    };
    ws.onerror = () => {
      process.stderr.write(`cannot reach ops stream at ${url}\n`);
      process.exit(1);
    };
    await new Promise(() => {}); // run until Ctrl-C
  });

/**
 * Post moderation — the human half of the Play user-content requirement.
 * Reports auto-hide at a threshold; an operator reviews and decides.
 */
const posts = program.command('posts').description('user posts — moderation');

posts
  .command('reported')
  .description('posts with reports, most-reported first')
  .action(async (_opts, command) => {
    const json = rootJson(command.parent as { parent: Command | null });
    const rows = await withPool(async (pool) => {
      const res = await pool.query(
        `select pp.id, pp.body, pp.media_url, pp.status, p.name as place,
                count(r.*)::int as reports,
                array_agg(distinct r.reason) as reasons
         from place_posts pp
         join places p on p.id = pp.place_id
         join place_post_reports r on r.post_id = pp.id
         group by pp.id, pp.body, pp.media_url, pp.status, p.name
         order by reports desc, pp.created_at desc`,
      );
      return res.rows;
    });
    process.stdout.write(render(rows, { json }) + '\n');
  });

posts
  .command('hide <postId>')
  .description('hide a post from every feed')
  .action(async (postId: string, _opts, command) => {
    const json = rootJson(command.parent as { parent: Command | null });
    const row = await withPool(async (pool) => {
      const res = await pool.query(
        `update place_posts set status = 'hidden' where id = $1 returning id, status`,
        [postId],
      );
      return res.rows[0] ?? null;
    });
    process.stdout.write(render(row ?? { error: 'not found' }, { json }) + '\n');
  });

posts
  .command('show <postId>')
  .description('restore a hidden post and clear its reports')
  .action(async (postId: string, _opts, command) => {
    const json = rootJson(command.parent as { parent: Command | null });
    const row = await withPool(async (pool) => {
      await pool.query(`delete from place_post_reports where post_id = $1`, [postId]);
      const res = await pool.query(
        `update place_posts set status = 'visible' where id = $1 returning id, status`,
        [postId],
      );
      return res.rows[0] ?? null;
    });
    process.stdout.write(render(row ?? { error: 'not found' }, { json }) + '\n');
  });

/**
 * The registrations inbox — the human half of onboarding. Spotters and
 * businesses are never self-serve (README rule): someone reads this list,
 * talks to the person, and only then runs `spotter add` or `property add`.
 */
const registrations = program
  .command('registrations')
  .description('people who asked to join — the onboarding inbox');

registrations
  .command('list')
  .description('pending registrations, newest first')
  .option('--all', 'include ones already handled')
  .action(async (opts: { all?: boolean }, command) => {
    const json = rootJson(command.parent as { parent: Command | null });
    const rows = await withPool(async (pool) => {
      const res = await pool.query(
        `select id, role, name, contact, language, details, created_at, handled_at, operator_note
         from registrations
         ${opts.all ? '' : 'where handled_at is null'}
         order by created_at desc`,
      );
      return res.rows;
    });
    process.stdout.write(render(rows, { json }) + '\n');
  });

registrations
  .command('handled <registrationId>')
  .description('mark as dealt with, so nobody calls them twice')
  .option('-n, --note <note>', 'what happened')
  .action(async (registrationId: string, opts: { note?: string }, command) => {
    const json = rootJson(command.parent as { parent: Command | null });
    const row = await withPool(async (pool) => {
      const res = await pool.query(
        `update registrations set handled_at = now(), operator_note = $2
         where id = $1 returning id, role, name, handled_at, operator_note`,
        [registrationId, opts.note ?? null],
      );
      return res.rows[0] ?? null;
    });
    process.stdout.write(render(row ?? { error: 'not found' }, { json }) + '\n');
  });

export async function main(argv: string[]): Promise<void> {
  await program.parseAsync(argv);
}

// Allow tests to import main; run only when executed directly.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  void main(process.argv);
}
