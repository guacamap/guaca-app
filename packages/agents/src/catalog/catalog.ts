import { createHash } from 'node:crypto';

/** Branded place id — never serialised into a model prompt. */
export type PlaceId = string & { readonly __brand: 'PlaceId' };

export interface CatalogRow {
  id: string;
  name: string;
  category: string;
  verificationStatus: string;
  witnessCount: number;
}

export interface CatalogEntry {
  placeId: PlaceId;
  name: string;
  category: string;
  /** ref as emitted to the model — small integers only, 1..N */
  ref: number;
}

/**
 * Immutable working set of verified places, built from DB rows. A row only
 * enters if it is `verified` with `witness_count >= 2` — a provisional or
 * under-witnessed row is refused entry, so its ref can never exist.
 *
 * Each entry gets a stable small-integer ref (1..N) assigned in row order.
 * placeId UUIDs are never sent to the model; refs are the entire
 * vocabulary the model can address (plan §7.3).
 */
export class Catalog {
  private constructor(
    private readonly entries: readonly CatalogEntry[],
    readonly fingerprint: string,
  ) {}

  static build(rows: readonly CatalogRow[]): Catalog {
    const entries: CatalogEntry[] = [];
    for (const row of rows) {
      if (row.verificationStatus !== 'verified') continue;
      if (row.witnessCount < 2) continue;
      entries.push({
        placeId: row.id as PlaceId,
        name: row.name,
        category: row.category,
        ref: entries.length + 1,
      });
    }
    const fingerprint = createHash('sha256')
      .update(entries.map((e) => `${e.ref}:${e.placeId}:${e.name}`).join('|'))
      .digest('hex');
    return new Catalog(entries, fingerprint);
  }

  get size(): number {
    return this.entries.length;
  }

  /** All refs in ascending order. */
  refs(): ReadonlySet<number> {
    return new Set(this.entries.map((e) => e.ref));
  }

  /** placeIds in ref order. */
  placeIds(): readonly PlaceId[] {
    return this.entries.map((e) => e.placeId);
  }

  byRef(ref: number): CatalogEntry {
    const entry = this.entries.find((e) => e.ref === ref);
    if (!entry) throw new Error(`unknown ref: ${ref}`);
    return entry;
  }

  /** JSON Schema for the model: an integer enum of exactly 1..N. */
  refEnum(): { type: 'integer'; enum: number[] } {
    return {
      type: 'integer',
      enum: this.entries.map((e) => e.ref),
    };
  }
}
