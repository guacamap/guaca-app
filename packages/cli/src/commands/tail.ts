export interface TailFilters {
  agent?: string;
  event?: string;
}

export interface LogLineLike {
  ts?: string;
  level?: string;
  event?: string;
  agent?: string;
  status?: string;
  latency_ms?: number;
  tokens_in?: number;
  tokens_out?: number;
  model?: string;
}

/** `guaca tail --agent gap --event refused` — filter the live stream. */
export function matchesFilters(line: LogLineLike, filters: TailFilters): boolean {
  if (filters.agent && line.agent !== filters.agent) return false;
  if (filters.event && line.event !== filters.event) return false;
  return true;
}

/** Pretty-print one structured log line — the judges watch this live. */
export function prettyPrint(line: LogLineLike): string {
  const parts = [
    line.ts ?? '',
    line.level?.toUpperCase() ?? '',
    `[${line.agent ?? '?'}]`,
    line.event ?? '',
    line.status ? `(${line.status})` : '',
  ];
  const head = parts.filter(Boolean).join(' ');
  const detail: string[] = [];
  if (line.latency_ms !== undefined) detail.push(`${line.latency_ms}ms`);
  if (line.tokens_in !== undefined) detail.push(`tokens_in=${line.tokens_in}`);
  if (line.tokens_out !== undefined) detail.push(`tokens_out=${line.tokens_out}`);
  if (line.model) detail.push(line.model);
  return detail.length > 0 ? `${head} — ${detail.join(' ')}` : head;
}
