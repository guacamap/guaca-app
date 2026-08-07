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
    // The shape is the contract: stops (array of {ref, startMin, durationMin,
    // reasonCode}) + languageCode. Every stop field is an integer or enum.
    // A hostile provider has no slot to fill.
    const stopShape = PlanDraft.shape.stops.element.shape;
    for (const key of Object.keys(stopShape) as Array<keyof typeof stopShape>) {
      const field = stopShape[key];
      const isInt = field._def.typeName === 'ZodNumber' && field._def.checks?.every(
        (c: { kind: string }) => c.kind === 'int' || c.kind === 'min' || c.kind === 'max',
      );
      const isEnum = field._def.typeName === 'ZodEnum';
      expect(isInt || isEnum, `${key} must be integer or enum`).toBe(true);
    }
    // languageCode is the only string anywhere, and it is an enum.
    expect(PlanDraft.shape.languageCode._def.typeName).toBe('ZodEnum');
  });

  it('bounds stops to 1..8 with integer refs and times', () => {
    const empty = PlanDraft.safeParse(validDraft({ stops: [] }));
    expect(empty.success).toBe(false);

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
    expect(nine.success).toBe(false);

    const floatRef = PlanDraft.safeParse(
      validDraft({
        stops: [{ ref: 1.5, startMin: 540, durationMin: 90, reasonCode: 'OPEN_NOW' }],
      }),
    );
    expect(floatRef.success).toBe(false);
  });
});
