import type { Pool } from 'pg';
import { hashPhoto } from '@guaca/agents';

export interface StorePhotoInput {
  placeId: string;
  image: Buffer;
  uploadedBySpotterId: string;
  /** Object-store key the bytes were written under — the API uploads to
   *  MinIO/S3 first, then records here. Synthesised when absent (tests). */
  storageKey?: string;
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
      input.storageKey ?? `${input.placeId}/${Date.now()}.jpg`,
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

export interface PlacePhotoRow {
  id: string;
  storageKey: string;
  sha256: string;
  phash: string;
  captureLat: number | null;
  captureLon: number | null;
  captureAccuracyM: number | null;
  capturedAt: Date | null;
  receivedAt: Date;
  uploadedBySpotterId: string | null;
}

/** The submission's photos, oldest first — the ladder verifies all of them. */
export async function photosForPlace(pool: Pool, placeId: string): Promise<PlacePhotoRow[]> {
  const res = await pool.query(
    `select id, storage_key, sha256, phash, capture_lat, capture_lon,
            capture_accuracy_m, captured_at, received_at, uploaded_by_spotter_id
     from place_photos where place_id = $1 order by received_at asc`,
    [placeId],
  );
  return res.rows.map((r) => ({
    id: r.id as string,
    storageKey: r.storage_key as string,
    sha256: r.sha256 as string,
    phash: r.phash as string,
    captureLat: (r.capture_lat as number) ?? null,
    captureLon: (r.capture_lon as number) ?? null,
    captureAccuracyM: (r.capture_accuracy_m as number) ?? null,
    capturedAt: (r.captured_at as Date) ?? null,
    receivedAt: r.received_at as Date,
    uploadedBySpotterId: (r.uploaded_by_spotter_id as string) ?? null,
  }));
}

/** pHash history for the L3 reuse rung — everything in the area EXCEPT the
 *  submission's own photos. */
export async function priorPhashesForArea(
  pool: Pool,
  areaId: string,
  excludePlaceId: string,
): Promise<string[]> {
  const res = await pool.query<{ phash: string }>(
    `select pp.phash
     from place_photos pp
     join places p on p.id = pp.place_id
     where p.area_id = $1 and pp.place_id <> $2`,
    [areaId, excludePlaceId],
  );
  return res.rows.map((r) => r.phash);
}
