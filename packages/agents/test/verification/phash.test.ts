import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { phash64, hammingDistance } from '../../src/verification/phash.ts';

function svg(size: number, shapes: string[], bg = 'white'): Buffer {
  return Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
       <rect width="100%" height="100%" fill="${bg}"/>
       ${shapes.join('')}
     </svg>`,
  );
}

async function pngOf(svgBuf: Buffer): Promise<Buffer> {
  return sharp(svgBuf).png().toBuffer();
}

describe('phash64', () => {
  it('identical images produce identical phash', async () => {
    const a = await pngOf(svg(128, ['<circle cx="40" cy="40" r="20" fill="#c82828"/>']));
    const b = await pngOf(svg(128, ['<circle cx="40" cy="40" r="20" fill="#c82828"/>']));
    const ha = await phash64(a);
    const hb = await phash64(b);
    expect(ha).toBe(hb);
    expect(ha).toMatch(/^[0-9a-f]{16}$/); // 64-bit hex
  });

  it('near-identical images produce close phash (small Hamming distance)', async () => {
    const a = await pngOf(svg(128, ['<circle cx="40" cy="40" r="20" fill="#c82828"/>']));
    // Same scene, 2px offset — perceptually near-identical.
    const b = await pngOf(svg(128, ['<circle cx="42" cy="40" r="20" fill="#c82828"/>']));
    const d = hammingDistance(await phash64(a), await phash64(b));
    expect(d).toBeLessThanOrEqual(12);
  });

  it('different images produce distant phash', async () => {
    const a = await pngOf(svg(128, ['<circle cx="40" cy="40" r="20" fill="#c82828"/>']));
    const b = await pngOf(svg(128, ['<rect x="30" y="30" width="60" height="60" fill="#1d5cb0"/>']));
    const d = hammingDistance(await phash64(a), await phash64(b));
    expect(d).toBeGreaterThan(12);
  });
});
