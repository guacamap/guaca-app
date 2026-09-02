import type { Pool } from 'pg';

const UA = 'guaca-app/1.0 (hola@guaca.live)';

interface Summary { title: string; description?: string; extract?: string; type?: string }

async function summary(lang: 'en' | 'es', title: string, fetchImpl: typeof fetch): Promise<Summary | null> {
  const res = await fetchImpl(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as Summary;
  if (j.type === 'disambiguation' || !j.extract) return null;
  return j;
}

async function searchTitle(lang: 'en' | 'es', q: string, fetchImpl: typeof fetch): Promise<string | null> {
  const res = await fetchImpl(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&srlimit=3&format=json&srsearch=${encodeURIComponent(q)}`, {
    headers: { 'user-agent': UA, accept: 'application/json' },
  });
  if (!res.ok) return null;
  const j = (await res.json()) as { query?: { search?: Array<{ title: string }> } };
  return j.query?.search?.[0]?.title ?? null;
}

/**
 * The Wikipedia summary for an area, by name and then by "name, country",
 * in both languages. Null when neither resolves to a real article.
 */
export async function fetchAreaAbout(
  name: string,
  countryName: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ en: string | null; es: string | null; source: string } | null> {
  // "Anguilla (Shoal Bay)" is an island and a beach; both are worth a try,
  // the wider one first because it is what a traveller stands in.
  const m = /^(.*?)\s*\((.*?)\)\s*$/.exec(name);
  const base = m?.[1]?.trim() ?? name;
  const inner = m?.[2]?.trim();
  const tries = [...new Set([base, `${base}, ${countryName}`, ...(inner ? [inner, `${inner}, ${countryName}`] : [])])];
  let en: Summary | null = null;
  let es: Summary | null = null;
  for (const t of tries) { en = en ?? (await summary('en', t, fetchImpl)); es = es ?? (await summary('es', t, fetchImpl)); }
  // Last resort: the article may carry a qualifier we cannot guess
  // ("Puerto Viejo de Talamanca", "St. John's, Antigua and Barbuda"). Ask
  // the search index for "<name> <country>" and take the first real article.
  if (!en) {
    const hit = await searchTitle('en', `${base} ${countryName}`, fetchImpl);
    if (hit) { en = await summary('en', hit, fetchImpl); es = es ?? (await summary('es', hit, fetchImpl)); }
  }
  if (!en && !es) return null;
  const clip = (s: string | undefined) => (s ? s.replace(/\s+/g, ' ').trim().slice(0, 900) : null);
  return { en: clip(en?.extract), es: clip(es?.extract), source: `wikipedia:${(en ?? es)!.title}` };
}

export async function refreshAreaAbout(pool: Pool, opts: { onlyMissing?: boolean; fetchImpl?: typeof fetch } = {}): Promise<{ updated: number; missing: string[] }> {
  const areas = await pool.query<{ id: string; name: string; country: string; about_en: string | null }>(
    `select id, name, country, about_en from areas order by name`,
  );
  const names = new Intl.DisplayNames(['en'], { type: 'region' });
  let updated = 0; const missing: string[] = [];
  for (const a of areas.rows) {
    if (opts.onlyMissing && a.about_en) continue;
    const about = await fetchAreaAbout(a.name, names.of(a.country) ?? a.country, opts.fetchImpl ?? fetch).catch(() => null);
    if (!about) { missing.push(a.name); continue; }
    await pool.query(`update areas set about_en = $2, about_es = $3, about_source = $4, about_refreshed_at = now() where id = $1`, [a.id, about.en, about.es, about.source]);
    updated++;
  }
  return { updated, missing };
}
