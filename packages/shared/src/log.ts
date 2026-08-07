/** One JSON line on stdout, per plan §7.6. */
export interface LogLine {
  ts: string; // ISO 8601 UTC
  level: 'debug' | 'info' | 'warn' | 'error';
  event: string;
  agent: 'planner' | 'gap' | 'verification' | 'api' | 'cli' | 'system';
  run_id?: string;
  node?: string;
  status?: 'ok' | 'rejected' | 'escalated' | 'error';
  latency_ms?: number;
  tokens_in?: number; // 0 for deterministic nodes — proves compute efficiency
  tokens_out?: number;
  model?: string;
  subject?: { type: string; id: string };
  detail?: Record<string, unknown>;
}
