/**
 * Downscale a camera photo before upload.
 *
 * A Spotter in Puerto Cabello is on prepaid mobile data. A modern phone
 * photo is 3–6 MB, base64 adds a third on top, and a verification needs
 * three of them — 12–24 MB per submission, on a network where that is both
 * expensive and likely to fail halfway. Resizing in the browser cuts it by
 * roughly 95%.
 *
 * Nothing downstream loses information it actually uses:
 * - the vision model downscales internally anyway;
 * - the perceptual hash is computed server-side and is resize-tolerant by
 *   construction — that is what makes it perceptual;
 * - capture coordinates travel as explicit fields, never read from EXIF,
 *   so stripping metadata costs nothing and removes data we never wanted.
 */
const MAX_EDGE = 1600;
const QUALITY = 0.82;

/** Reads the file unchanged — the fallback when canvas encoding is absent. */
function readAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

export async function photoToBase64(file: File): Promise<string> {
  try {
    // imageOrientation honours EXIF rotation, which a bare canvas draw drops
    // — otherwise portrait shots arrive sideways and the vision rung sees a
    // rotated storefront.
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('no 2d context');
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
    const base64 = dataUrl.split(',')[1] ?? '';
    if (!base64) throw new Error('encode failed');
    return base64;
  } catch {
    // Any failure sends the original: a heavier upload beats a lost mission.
    return readAsBase64(file);
  }
}
