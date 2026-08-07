export interface JsonOutput<T> {
  kind: 'json';
  data: T;
}

/**
 * Every `guaca` command authenticates with OPERATOR_TOKEN (§9). Commands
 * that mutate state REQUIRE it; read-only commands warn if absent.
 */
export function requireOperatorToken(token: string | undefined): string {
  if (!token || token.length === 0) {
    throw new Error('OPERATOR_TOKEN is not set — refusing to run');
  }
  return token;
}

export interface RenderOptions {
  json: boolean;
}

/** --json on every command: a single JSON line; human-readable otherwise. */
export function render(data: unknown, opts: RenderOptions): string {
  if (opts.json) {
    return JSON.stringify(data);
  }
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const lines: string[] = [];
    for (const [k, v] of Object.entries(obj)) {
      lines.push(`${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`);
    }
    return lines.join('\n');
  }
  return String(data);
}
