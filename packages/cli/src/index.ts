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
    const mutating = ['verify', 'commission', 'override', 'pay', 'spotter'];
    const name = actionCommand.name();
    if (mutating.includes(name)) {
      requireOperatorToken(process.env.OPERATOR_TOKEN);
    }
  });

program
  .command('whoami')
  .description('show the operator identity')
  .action((opts, command) => {
    const root = command.parent!;
    const json = root.opts().json ?? false;
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
    const json = command.parent!.opts().json ?? false;
    const { pool } = await import('@guaca/db');
    const { auditCommand, renderAudit } = await import('./commands/audit.js');
    try {
      const result = await auditCommand(pool, {
        areaId,
        narrative: opts.narrative ?? false,
        language: opts.es ? 'es' : 'en',
      });
      process.stdout.write(renderAudit(result, { json }) + '\n');
    } finally {
      await pool.end();
    }
  });

export async function main(argv: string[]): Promise<void> {
  await program.parseAsync(argv);
}

// Allow tests to import main; run only when executed directly.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  void main(process.argv);
}
