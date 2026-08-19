import { describe, expect, it } from 'vitest';
import { PlanDraft } from '../../src/guard/planDraft.ts';

function validDraft(overrides: Record<string, unknown> = {}) {
  return {
    stops: [
      {
        ref: 1,
        startMin: 540,
        durationMin: 90,
        reasonCode: 'OPEN_NOW',
      },
    ],
    languageCode: 'en',
    ...overrides,
  };
}

describe('PlanDraft', () => {
  it('accepts a valid draft', () => {
    expect(PlanDraft.safeParse(validDraft()).success).toBe(true);
  });

  it('rejects an extra placeName key (strict schema)', () => {
    const parsed = PlanDraft.safeParse(
      validDraft({ placeName: 'La Sirena Dorada' }),
    );
    expect(parsed.success).toBe(false);
  });

  it('rejects a title field on a stop', () => {
    const parsed = PlanDraft.safeParse(
      validDraft({
        stops: [
          {
            ref: 1,
            startMin: 540,
            durationMin: 90,
            reasonCode: 'OPEN_NOW',
            title: 'La Sirena Dorada',
          },
        ],
      }),
    );
    expect(parsed.success).toBe(false);
  });

  it('has no string field capable of naming a place anywhere in the schema', () => {
    // The shape is the contract: stops (array of {ref, dayIndex, startMin,
    // durationMin, reasonCode}) + languageCode. Every stop field is an
    // integer or enum — unwrap ZodDefault (dayIndex's 0 default) to the leaf.
    // A hostile provider has no slot to fill.
    const stopShape = PlanDraft.shape.stops.element.shape;
    const leaf = (field: { _def: { typeName: string; innerType?: unknown } }): unknown =>
      field._def.typeName === 'ZodDefault'
        ? (field._def.innerType as typeof field)
        : field;
    for (const key of Object.keys(stopShape) as Array<keyof typeof stopShape>) {
      const field = leaf(stopShape[key] as never) as {
        _def: { typeName: string; checks?: Array<{ kind: string }> };
      };
      const isInt =
        field._def.typeName === 'ZodNumber' &&
        field._def.checks?.every(
          (c) => c.kind === 'int' || c.kind === 'min' || c.kind === 'max',
        );
      const isEnum = field._def.typeName === 'ZodEnum';
      expect(isInt || isEnum, `${key} must be integer or enum`).toBe(true);
    }
    // languageCode is the only string anywhere, and it is an enum.
    expect(PlanDraft.shape.languageCode._def.typeName).toBe('ZodEnum');
  });

  it('bounds a trip: 1..24 stops total, dayIndex 0..6, integer refs and times', () => {
    const empty = PlanDraft.safeParse(validDraft({ stops: [] }));
    expect(empty.success).toBe(false);

    // Nine stops PARSE at schema level now (multi-day trips may hold 24) —
    // the per-day cap of 8 is a guard step-7 check, pinned in
    // assertGrounded.test.ts. The schema's job is the total bound:
    const nine = PlanDraft.safeParse(
      validDraft({
        stops: Array.from({ length: 9 }, (_, i) => ({
          ref: i + 1,
          startMin: 540,
          durationMin: 90,
          reasonCode: 'OPEN_NOW',
        })),
      }),
    );
    expect(nine.success).toBe(true);

    const twentyFive = PlanDraft.safeParse(
      validDraft({
        stops: Array.from({ length: 25 }, (_, i) => ({
          ref: (i % 12) + 1,
          dayIndex: i % 7,
          startMin: 540,
          durationMin: 90,
          reasonCode: 'OPEN_NOW',
        })),
      }),
    );
    expect(twentyFive.success).toBe(false);

    const dayEight = PlanDraft.safeParse(
      validDraft({
        stops: [{ ref: 1, dayIndex: 7, startMin: 540, durationMin: 90, reasonCode: 'OPEN_NOW' }],
      }),
    );
    expect(dayEight.success).toBe(false);

    const floatRef = PlanDraft.safeParse(
      validDraft({
        stops: [{ ref: 1.5, startMin: 540, durationMin: 90, reasonCode: 'OPEN_NOW' }],
      }),
    );
    expect(floatRef.success).toBe(false);
  });

  it('dayIndex omitted means day 0 — a legacy single-day draft parses unchanged', () => {
    const parsed = PlanDraft.safeParse(validDraft());
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.stops[0]!.dayIndex).toBe(0);
    }
  });
});
