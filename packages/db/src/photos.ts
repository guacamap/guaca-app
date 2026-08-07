import type { Pool } from 'pg';
import { hashPhoto } from '@guaca/agents';

export interface StorePhotoInput {
  placeId: string;
  image: Buffer;
  uploadedBySpotterId: string;
  capture?: {
    lat?: number;
    lon?: number;
    accuracyM?: number;
    capturedAt?: Date;
  };
}

export interface StoredPhoto {
  id: string;
  sha256: string;
  phash: string;
}

/**
 * Store a photo submission: compute sha256 + phash, persist capture
 * metadata from the client payload, and record server receipt time.
 * Exists as a db-layer function so the API route stays thin and tests
 * can exercise it without MinIO.
 */
export async function storePhoto(pool: Pool, input: StorePhotoInput): Promise<StoredPhoto> {
  const { sha256, phash } = await hashPhoto(input.image);
  const res = await pool.query<{ id: string }>(
    `insert into place_photos
       (place_id, storage_key, sha256, phash,
        capture_lat, capture_lon, capture_accuracy_m, captured_at,
        uploaded_by_spotter_id)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     returning id`,
    [
      input.placeId,
      `${input.placeId}/${Date.now()}.jpg`,
      sha256,
      phash,
      input.capture?.lat ?? null,
      input.capture?.lon ?? null,
      input.capture?.accuracyM ?? null,
      input.capture?.capturedAt ?? null,
      input.uploadedBySpotterId,
    ],
  );
  return { id: res.rows[0]!.id, sha256, phash };
}
