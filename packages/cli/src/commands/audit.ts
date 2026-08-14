import type { Pool } from 'pg';
import { loadMapHealthStats } from '@guaca/db';
import {
  analyzeMapHealth,
  narrateMapHealth,
  createProvider,
  type Inference,
  type MapHealthAnalysis,
  type HealthNarrative,
} from '@guaca/agents';

export interface AuditResult {
  areaId: string;
  analysis: MapHealthAnalysis;
  narrative: HealthNarrative | null;
  narrativeSkipped?: string;
}

export interface AuditOptions {
  areaId?: string;
  /** One optional inference call for operator prose; the audit itself is SQL + arithmetic. */
  narrative?: boolean;
  language?: 'en' | 'es';
  inference?: Inference;
}

/** `guaca audit` — map-health findings + demand-driven mission candidates. */
export async function auditCommand(pool: Pool, options: AuditOptions = {}): Promise<AuditResult> {
  let areaId = options.areaId;
  if (!areaId) {
    const res = await pool.query(`select id from areas order by created_at asc limit 1`);
    areaId = res.rows[0]?.id as string | undefined;
    if (!areaId) throw new Error('no areas exist — run pnpm seed first');
  }

  const stats = await loadMapHealthStats(pool, areaId);
  const analysis = analyzeMapHealth(stats);

  let narrative: HealthNarrative | null = null;
  let narrativeSkipped: string | undefined;
  if (options.narrative) {
    const inference =
      options.inference ??
      (process.env.INFERENCE_BASE_URL
        ? createProvider({
            INFERENCE_BASE_URL: process.env.INFERENCE_BASE_URL,
            INFERENCE_API_KEY: process.env.INFERENCE_API_KEY ?? 'changeme',
            INFERENCE_MODEL: process.env.INFERENCE_MODEL ?? 'Qwen/Qwen3-VL-8B-Instruct',
          })
        : undefined);
    if (!inference) narrativeSkipped = 'INFERENCE_BASE_URL not set — deterministic report only';
    else {
      narrative = await narrateMapHealth(inference, analysis, options.language ?? 'en');
      if (!narrative) narrativeSkipped = 'inference unavailable — deterministic report only';
    }
  }

  return { areaId, analysis, narrative, ...(narrativeSkipped ? { narrativeSkipped } : {}) };
}

const SEVERITY_MARK: Record<number, string> = { 3: '!!!', 2: '!! ', 1: '!  ' };

export function renderAudit(result: AuditResult, opts: { json: boolean }): string {
  if (opts.json) return JSON.stringify(result);
  const { analysis } = result;
  const lines: string[] = [
    `map health — area ${result.areaId}`,
    `verified places: ${analysis.totals.verified} · refused asks: ${analysis.totals.refusedAsks}`,
    '',
    'FINDINGS',
  ];
  if (analysis.findings.length === 0) lines.push('  (none — the map is healthy)');
  for (const f of analysis.findings) {
    lines.push(`  [${SEVERITY_MARK[f.severity]}] ${f.kind}${f.category ? ` · ${f.category}` : ''} — ${f.detail}`);
  }
  lines.push('', 'MISSION CANDIDATES (demand-driven; commission via `guaca commission`)');
  if (analysis.missionCandidates.length === 0) lines.push('  (none — no unmet demand recorded)');
  analysis.missionCandidates.forEach((c, i) => {
    lines.push(`  ${i + 1}. ${c.category} — priority ${c.priority} (${c.reason})`);
  });
  if (result.narrative) {
    lines.push('', 'ANALYST NOTE (model-written from the data above)');
    lines.push(`  ${result.narrative.summary}`);
    for (const p of result.narrative.priorities) lines.push(`  • ${p}`);
  } else if (result.narrativeSkipped) {
    lines.push('', `note: ${result.narrativeSkipped}`);
  }
  return lines.join('\n');
}
