/**
 * How much Guaca knows about a place, in the order it prefers them.
 *
 * - verified: a local stood there (two of them, in fact).
 * - corroborated: two or more independent open datasets agree it exists.
 * - listed: one open dataset only.
 *
 * Every stop in a plan carries its tier in plain words; nothing is hidden
 * behind a "verified" that was not.
 */
export type PlaceTier = 'verified' | 'corroborated' | 'listed';

export const TIER_RANK: Record<PlaceTier, number> = { verified: 0, corroborated: 1, listed: 2 };

export function tierOf(verificationStatus: string, witnessCount: number, corroboration: number): PlaceTier {
  if (verificationStatus === 'verified' && witnessCount >= 2) return 'verified';
  return corroboration >= 2 ? 'corroborated' : 'listed';
}

/** What a stop line says about its tier, in the traveller's language. */
export function tierWords(tier: PlaceTier, lang: string, opts: { corroboration?: number; verifiedAt?: string | null; spotter?: string | null } = {}): string {
  const es = lang === 'es';
  if (tier === 'verified') {
    const who = opts.spotter ? (es ? ` por ${opts.spotter}` : ` by ${opts.spotter}`) : '';
    const when = opts.verifiedAt ? ` (${opts.verifiedAt.slice(0, 10)})` : '';
    return es ? `verificado en persona${who}${when}` : `verified in person${who}${when}`;
  }
  if (tier === 'corroborated') {
    const n = opts.corroboration ?? 2;
    return es ? `${n} mapas abiertos coinciden, nadie de Guaca ha ido aún` : `${n} open maps agree it exists, nobody from Guaca has been yet`;
  }
  return es ? 'listado una vez, sin confirmar' : 'listed once, unconfirmed';
}
