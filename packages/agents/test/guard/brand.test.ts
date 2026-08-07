import { describe, expect, it } from 'vitest';
import type { PlanArtifact } from '../../src/guard/assertGrounded.ts';
import { renderItinerary, type RenderPlace } from '../../src/render/itinerary.ts';

/**
 * The product's central claim is that assertGrounded is the ONLY place a
 * PlanArtifact can come into existence. A comment cannot enforce that; the
 * type has to. These are compile-time tests — they are checked by
 * `pnpm lint` (tsconfig.test.json), not by the vitest runtime.
 *
 * If the brand is ever weakened, the @ts-expect-error directives below become
 * unused and tsc fails the build. That is the point.
 */
describe('PlanArtifact is unforgeable', () => {
  it('an object literal cannot be typed as a PlanArtifact', () => {
    // @ts-expect-error — forging a grounded artifact must not compile.
    const forged: PlanArtifact = {
      placeIds: ['totally-made-up-id'],
      stops: [
        {
          placeId: 'totally-made-up-id',
          startMin: 600,
          durationMin: 60,
          reasonCode: 'OPEN_NOW',
        },
      ],
    };
    expect(forged).toBeDefined();
  });

  it('the old kind-tag shape cannot be typed as a PlanArtifact either', () => {
    // Kept on one line: @ts-expect-error only covers the line directly below,
    // and an excess-property error is reported at the offending property.
    // @ts-expect-error — a discriminant string is not a brand.
    const forged: PlanArtifact = { kind: 'PlanArtifact', placeIds: [], stops: [] };
    expect(forged).toBeDefined();
  });

  it('the minting cast appears ONLY inside the guard, across the whole repo', async () => {
    // The brand's one escape hatch is `as unknown as PlanArtifact`. Tests may
    // use it; production code anywhere in the workspace may not, except at the
    // construction sites inside the guard module itself.
    const { readdir, readFile } = await import('node:fs/promises');
    const { join, dirname } = await import('node:path');
    const { fileURLToPath } = await import('node:url');
    const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..');

    async function walk(dir: string): Promise<string[]> {
      const out: string[] = [];
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        return out;
      }
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.next') continue;
        const p = join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(p)));
        else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) out.push(p);
      }
      return out;
    }

    // Every production source tree in the workspace, not just this package.
    const roots = [
      join(ROOT, 'packages', 'agents', 'src'),
      join(ROOT, 'packages', 'db', 'src'),
      join(ROOT, 'packages', 'shared', 'src'),
      join(ROOT, 'packages', 'cli', 'src'),
      join(ROOT, 'apps', 'api', 'src'),
      join(ROOT, 'apps', 'web', 'src'),
    ];

    const offenders: string[] = [];
    for (const root of roots) {
      for (const file of await walk(root)) {
        const body = await readFile(file, 'utf8');
        // Either spelling of a forged mint: the explicit cast, or the `as
        // never` dodge that slips an object literal past the brand.
        const cast = body.match(/as\s+unknown\s+as\s+PlanArtifact/g) ?? [];
        const dodge = body.match(/kind:\s*'PlanArtifact'[\s\S]{0,400}?as\s+never/g) ?? [];
        if (cast.length + dodge.length > 0) offenders.push(file);
      }
    }

    // Exactly one file may mint, and it must be the guard.
    expect(offenders).toHaveLength(1);
    expect(offenders[0]).toMatch(/guard[/\\]assertGrounded\.ts$/);
  });

  it('the renderer only accepts a genuinely grounded artifact', () => {
    const places = new Map<string, RenderPlace>([
      [
        'totally-made-up-id',
        {
          id: 'totally-made-up-id',
          name: 'La Sirena Dorada',
          landmarkDescription: 'x',
          category: 'eat_drink',
        },
      ],
    ]);
    // @ts-expect-error — an unbranded object must not reach renderItinerary.
    const out = renderItinerary({ placeIds: [], stops: [] }, places, 'en');
    expect(typeof out).toBe('string');
  });
});
