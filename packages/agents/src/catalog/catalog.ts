import { createHash } from 'node:crypto';
import type { PlaceTier } from '@guaca/shared';

/** Branded place id — never serialised into a model prompt. */
export type PlaceId = string & { readonly __brand: 'PlaceId' };

export interface CatalogRow {
  id: string;
  name: string;
  category: string;
  verificationStatus: string;
  witnessCount: number;
  /** Tiered honesty: a corroborated or listed open-data row may enter when the caller says so. */
  tier?: PlaceTier;
  corroboration?: number;
  subcategory?: string | null;
}

export interface CatalogEntry {
  placeId: PlaceId;
  name: string;
  category: string;
  tier: PlaceTier;
  corroboration: number;
  subcategory: string | null;
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
      const verified = row.verificationStatus === 'verified' && row.witnessCount >= 2;
      // A row enters verified, or explicitly tiered by the caller (an open
      // dataset row the retrieval chose to offer). Anything else has no ref.
      const tier: PlaceTier | null = verified ? 'verified' : row.tier === 'corroborated' || row.tier === 'listed' ? row.tier : null;
      if (!tier) continue;
      entries.push({
        placeId: row.id as PlaceId,
        name: row.name,
        category: row.category,
        tier,
        corroboration: row.corroboration ?? 0,
        subcategory: row.subcategory ?? null,
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

  /** The listing the planner reads: one line per ref, names included, ids never. */
  listing(): string {
    return this.entries
      .map((e) => `${e.ref}: ${e.name} [${e.category}${e.subcategory ? `, ${e.subcategory}` : ''}] (${e.tier}${e.tier === 'corroborated' ? ` by ${e.corroboration} open maps` : ''})`)
      .join('\n');
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
