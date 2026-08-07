import { describe, expect, it } from 'vitest';
import { matchesFilters, prettyPrint, TailFilters } from '../src/commands/tail.ts';

describe('T6.6 — guaca tail filters and formatting', () => {
  const line = {
    ts: '2026-08-06T14:03:22.114Z',
    level: 'info',
    event: 'agent.node.complete',
    agent: 'gap',
    status: 'ok',
    latency_ms: 812,
    tokens_in: 0,
    tokens_out: 96,
    model: 'qwen3-vl-8b',
  };

  it('matches when no filters are set', () => {
    expect(matchesFilters(line, {})).toBe(true);
  });

  it('filters by agent', () => {
    const f: TailFilters = { agent: 'planner' };
    expect(matchesFilters(line, f)).toBe(false);
    expect(matchesFilters(line, { agent: 'gap' })).toBe(true);
  });

  it('filters by event', () => {
    expect(matchesFilters(line, { event: 'agent.node.complete' })).toBe(true);
    expect(matchesFilters(line, { event: 'refused' })).toBe(false);
  });

  it('combines agent and event filters', () => {
    expect(matchesFilters(line, { agent: 'gap', event: 'agent.node.complete' })).toBe(true);
    expect(matchesFilters(line, { agent: 'planner', event: 'agent.node.complete' })).toBe(false);
  });

  it('pretty-prints one line per event with the key fields', () => {
    const out = prettyPrint(line);
    expect(out).toContain('gap');
    expect(out).toContain('agent.node.complete');
    expect(out).toContain('812ms');
    expect(out).toContain('tokens_in=0'); // the compute-efficiency proof is visible
  });
});
