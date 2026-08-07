import { describe, expect, it } from 'vitest';
import {
  answerDeterministic,
  greedyRoute,
  type FastPathResult,
} from '../../src/planner/fastPath.ts';
import { FakeInference } from '../../src/inference/fake.ts';

const places = [
  { id: 'p1', name: 'Arepera La Guacamaya', category: 'eat_drink', landmarkDescription: 'Casa amarilla', lat: 10.4716, lon: -68.0056, openAt: 540, closeAt: 1320 },
  { id: 'p2', name: 'Café El Puerto', category: 'eat_drink', landmarkDescription: 'Frente al malecón', lat: 10.472, lon: -68.006, openAt: 420, closeAt: 1380 },
  { id: 'p3', name: 'Playa Quizandal', category: 'beach_water', landmarkDescription: 'Al final de la avenida', lat: 10.455, lon: -68.002, openAt: 0, closeAt: 1440 },
];

describe('greedyRoute', () => {
  it('routes a single-topic now question to the nearest open place', () => {
    const stops = greedyRoute({
      places,
      category: 'eat_drink',
      startMin: 540,
      partySize: 2,
    });
    expect(stops.length).toBeGreaterThan(0);
    expect(stops[0]!.placeId).toBe('p1'); // nearest open eat_drink
  });

  it('skips places closed at the requested time', () => {
    const stops = greedyRoute({
      places: [{ ...places[0]!, openAt: 800, closeAt: 900 }],
      category: 'eat_drink',
      startMin: 540,
      partySize: 2,
    });
    expect(stops).toHaveLength(0);
  });

  it('never duplicates a stop', () => {
    const stops = greedyRoute({
      places,
      category: 'eat_drink',
      startMin: 540,
      partySize: 8,
    });
    const ids = stops.map((s) => s.placeId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('answerDeterministic (T4.4)', () => {
  it('answers a single-topic now question with ZERO inference calls', async () => {
    const fake = new FakeInference({});
    const result = await answerDeterministic({
      text: 'where can I eat arepas now?',
      language: 'en',
      lat: 10.4716,
      lon: -68.0056,
      places,
      inference: fake,
    });
    if (result === null) throw new Error('expected a fast-path plan');
    expect(result.kind).toBe('FastPathPlan');
    // The compute-efficiency proof: the fast path never touches the model.
    expect(fake.calls).toHaveLength(0);
  });

  it('returns null for a question that is not single-topic-now (falls through to model)', async () => {
    const fake = new FakeInference({});
    const result = await answerDeterministic({
      text: 'plan a full day for me with a museum, lunch and a beach',
      language: 'en',
      lat: 10.4716,
      lon: -68.0056,
      places,
      inference: fake,
    });
    expect(result).toBeNull();
    expect(fake.calls).toHaveLength(0); // still no call — the model path is separate
  });

  it('routes a beach question to beach_water places', async () => {
    const result = await answerDeterministic({
      text: 'where can I snorkel right now?',
      language: 'en',
      lat: 10.4716,
      lon: -68.0056,
      places,
      inference: new FakeInference({}),
    });
    if (result === null) throw new Error('expected a fast-path plan');
    const plan = result;
    expect(plan.kind).toBe('FastPathPlan');
    expect(plan.stops[0]!.placeId).toBe('p3');
  });
});
