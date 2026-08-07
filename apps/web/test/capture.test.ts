import { describe, expect, it } from 'vitest';
import {
  canSubmitWithAccuracy,
  AccuracyGate,
} from '../src/capture.ts';

describe('T7.3 — capture accuracy gate', () => {
  it('blocks submission when accuracy is worse than tolerance', () => {
    const g: AccuracyGate = canSubmitWithAccuracy(60, 50);
    expect(g.ok).toBe(false);
    expect(g.reason).toMatch(/accuracy/i);
  });

  it('allows submission at or better than tolerance', () => {
    expect(canSubmitWithAccuracy(40, 50).ok).toBe(true);
    expect(canSubmitWithAccuracy(50, 50).ok).toBe(true);
  });

  it('blocks when geolocation is unavailable', () => {
    const g = canSubmitWithAccuracy(null, 50);
    expect(g.ok).toBe(false);
  });
});
