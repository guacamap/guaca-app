import { SCENARIO_CHECKPOINT, type ScenarioCheckpoint } from './seed/scenarioLifecycle.js';

export function formatCheckpoint(snapshot: ScenarioCheckpoint & { ok?: boolean }): string {
  const keys = Object.keys(SCENARIO_CHECKPOINT) as Array<keyof ScenarioCheckpoint>;
  const lines = keys.map((key) => {
    const got = snapshot[key];
    const want = SCENARIO_CHECKPOINT[key];
    const mark = got === want ? 'ok' : `want ${want}`;
    return `${key}\t${got}\t${mark}`;
  });
  if (snapshot.ok === false) lines.push('checkpoint\tmiss');
  else if (snapshot.ok === true) lines.push('checkpoint\tok');
  return lines.join('\n');
}
