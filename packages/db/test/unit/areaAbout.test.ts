import { describe, expect, it } from 'vitest';
import { fetchAreaAbout } from '../../src/seed/areaAbout.js';

const fake = (pages: Record<string, unknown>) =>
  (async (url: string | URL | Request) => {
    const u = String(url);
    const key = Object.keys(pages).find((k) => u.includes(k));
    return key
      ? new Response(JSON.stringify(pages[key]), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response('{}', { status: 404 });
  }) as unknown as typeof fetch;

describe('the area summary', () => {
  it('takes the plain title when it is an article, in both languages', async () => {
    const r = await fetchAreaAbout('Puerto Cabello', 'Venezuela', fake({
      'en.wikipedia.org/api/rest_v1/page/summary/Puerto_Cabello': { title: 'Puerto Cabello', type: 'standard', extract: 'Puerto Cabello is a city on the north coast of Venezuela.' },
      'es.wikipedia.org/api/rest_v1/page/summary/Puerto_Cabello': { title: 'Puerto Cabello', type: 'standard', extract: 'Puerto Cabello es una ciudad venezolana.' },
    }));
    expect(r).toEqual({ en: 'Puerto Cabello is a city on the north coast of Venezuela.', es: 'Puerto Cabello es una ciudad venezolana.', source: 'wikipedia:Puerto Cabello' });
  });
  it('skips a disambiguation page and tries "name, country"', async () => {
    const r = await fetchAreaAbout('Kingston', 'Jamaica', fake({
      'summary/Kingston%2C_Jamaica': { title: 'Kingston, Jamaica', type: 'standard', extract: 'Kingston is the capital of Jamaica.' },
      'summary/Kingston': { title: 'Kingston', type: 'disambiguation', extract: 'Kingston may refer to:' },
    }));
    expect(r?.en).toBe('Kingston is the capital of Jamaica.');
    expect(r?.source).toBe('wikipedia:Kingston, Jamaica');
  });
  it('is null when nothing resolves', async () => {
    expect(await fetchAreaAbout('Nowhere', 'Atlantis', fake({}))).toBeNull();
  });
});
