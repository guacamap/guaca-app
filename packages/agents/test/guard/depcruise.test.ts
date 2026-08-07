import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const PKG = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function cruise(files: string[]): { cruised: number; violations: unknown[] } {
  const out = execFileSync(
    'pnpm',
    [
      'dlx',
      'dependency-cruiser@16',
      '--config',
      '.dependency-cruiser.json',
      '--ts-pre-compilation-deps',
      '--output-type',
      'json',
      ...files,
    ],
    { cwd: PKG, encoding: 'utf8' },
  );
  const report = JSON.parse(out) as { summary: { totalCruised: number; violations: unknown[] } };
  return { cruised: report.summary.totalCruised, violations: report.summary.violations };
}

describe('dependency-cruiser C2', () => {
  it('the render → inference/graphs edge count is 0 across src/render', () => {
    const { cruised, violations } = cruise(['src/render']);
    expect(cruised).toBeGreaterThan(0);
    expect(violations).toHaveLength(0);
  });

  it('deliberately adding the forbidden import turns the run red', () => {
    // A synthetic module in src/render that imports from src/inference is
    // caught by the rule. We simulate it with a temp file inside the package.
    const { writeFileSync, mkdirSync, rmSync } = require('node:fs');
    const fake = join(PKG, 'src', 'render', '__forbidden_probe__.ts');
    const fakeInf = join(PKG, 'src', 'inference', '__probe__.ts');
    mkdirSync(join(PKG, 'src', 'inference'), { recursive: true });
    writeFileSync(fakeInf, 'export const probe = 1;\n');
    writeFileSync(
      fake,
      `import { probe } from '../inference/__probe__.js';\nexport const x = probe;\n`,
    );
    try {
      const { violations } = cruise(['src/render/__forbidden_probe__.ts']);
      expect(violations.length).toBeGreaterThan(0);
    } finally {
      rmSync(fake, { force: true });
      rmSync(fakeInf, { force: true });
    }
  });
});
