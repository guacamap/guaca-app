import sharp from 'sharp';
import phashFn from 'sharp-phash';

// sharp-phash's runtime default export is the phash function itself; under
// ESM interop it may surface as a nested default. Normalise once.
const phash: (image: Buffer, options?: Parameters<typeof sharp>[1]) => Promise<string> =
  (
    (phashFn as unknown as { default?: typeof phashFn }).default ?? phashFn
  ) as unknown as (
    image: Buffer,
    options?: Parameters<typeof sharp>[1],
  ) => Promise<string>;

/**
 * 64-bit perceptual hash (plan §7.4, rung 3). Identical images hash equal;
 * near-identical images sit a few bits apart; Hamming distance drives
 * PHOTO_REUSE and NO_DIVERSITY decisions.
 */
export async function phash64(image: Buffer): Promise<string> {
  // sharp-phash resolves to a 64-char '01' string; store as 16 hex chars.
  const bits = await phash(image);
  let hex = '';
  for (let i = 0; i < bits.length; i += 4) {
    hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  }
  return hex;
}

/** Hamming distance between two 64-bit hex hashes. */
export function hammingDistance(a: string, b: string): number {
  let d = 0;
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const x = parseInt(a[i] ?? '0', 16);
    const y = parseInt(b[i] ?? '0', 16);
    let xor = x ^ y;
    while (xor > 0) {
      d += xor & 1;
      xor >>= 1;
    }
  }
  return d;
}

/** sha256 of the original file bytes — stored alongside the phash. */
export async function sha256Hex(image: Buffer): Promise<string> {
  const { createHash } = await import('node:crypto');
  return createHash('sha256').update(image).digest('hex');
}

/** Convenience for T3.1: both hashes for an uploaded photo. */
export async function hashPhoto(image: Buffer): Promise<{ sha256: string; phash: string }> {
  const [s, p] = await Promise.all([sha256Hex(image), phash64(image)]);
  return { sha256: s, phash: p };
}
