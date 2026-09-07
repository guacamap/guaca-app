import { describe, expect, it } from 'vitest';
import { answerFromCatalog } from '../../src/planner/pipeline.js';
import { answerDeterministic } from '../../src/planner/fastPath.js';
import { renderItinerary } from '../../src/render/itinerary.js';
import { groundFromVerifiedRows } from '../../src/guard/assertGrounded.js';
import { FakeInference } from '../../src/inference/fake.js';

const places = [
  { id: 'beach', name: 'Beach from database', category: 'beach_water' },
  { id: 'food', name: 'Cafe from database', category: 'eat_drink' },
].map(p => ({ ...p, lat: 10.47, lon: -68, verificationStatus: 'verified', witnessCount: 2, landmarkDescription: '' }));

describe('place suggestions are not a timed itinerary', () => {
  it('covers breakfast and beach even at night without model calls', async () => {
    const result = await answerFromCatalog({ recommendations: true, text: 'a beach and a good breakfast', language: 'en', lat: 10.47, lon: -68, minCandidates: 1, nowMin: 1240, places, inference: new FakeInference({}) });
    expect(result.kind).toBe('answer');
    if (result.kind === 'answer') expect(new Set(result.placeIds)).toEqual(new Set(['beach', 'food']));
  });
  it('does not pretend to cover a missing category', async () => {
    const result = await answerFromCatalog({ recommendations: true, text: 'beach and breakfast', language: 'en', lat: 10.47, lon: -68, minCandidates: 1, places: places.slice(0, 1), inference: new FakeInference({}) });
    expect(result.kind).toBe('refusal');
  });
  it('single-topic fast path cannot drop a second topic', async () => {
    const result = await answerDeterministic({ text: 'beach and breakfast', language: 'en', lat: 10.47, lon: -68, nowMin: 600, places: places.map(p => ({ ...p, openAt: 0, closeAt: 1440 })), inference: new FakeInference({}) });
    expect(result).toBeNull();
  });
  it.each(['en', 'es'])('renders names, uncertainty and a morning follow-up without a fake schedule (%s)', (lang) => {
    const artifact = groundFromVerifiedRows(places.map(p => ({ placeId: p.id, startMin: 1240, durationMin: 60, reasonCode: 'NEAREST' })), new Set(places.map(p => p.id)));
    const text = renderItinerary(artifact, new Map(places.map(p => [p.id, p])), lang, { recommendations: true, breakfast: true, evening: true });
    expect(text).toContain('Cafe from database');
    expect(text).toContain('Beach from database');
    expect(text.indexOf('Cafe from database')).toBeLessThan(text.indexOf('Beach from database'));
    expect(text).not.toMatch(/20:40|closest to you|Here is your plan/);
    expect(text).toContain(lang === 'es' ? 'menú' : 'menu');
    expect(text).toContain(lang === 'es' ? 'mañana' : 'tomorrow');
  });
});
