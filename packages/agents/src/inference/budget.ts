export class BudgetExceeded extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BudgetExceeded';
  }
}

export interface BudgetLimits {
  maxModelCalls: number;
  maxCostUnits: number;
  maxWallMs: number;
}

/**
 * Rides in the run context (§7.9). Exceeding it throws BudgetExceeded, which
 * every graph routes to a refusal or escalation — never to a degraded answer.
 */
export class RunBudget {
  calls = 0;
  costUnits = 0;
  startedAt = Date.now();

  constructor(readonly limits: BudgetLimits) {}

  recordCall(costUnits: number): void {
    this.calls += 1;
    this.costUnits += costUnits;
    if (this.calls > this.limits.maxModelCalls) {
      throw new BudgetExceeded(`maxModelCalls exceeded (${this.calls} > ${this.limits.maxModelCalls})`);
    }
    if (this.costUnits > this.limits.maxCostUnits) {
      throw new BudgetExceeded(`maxCostUnits exceeded`);
    }
    if (Date.now() - this.startedAt > this.limits.maxWallMs) {
      throw new BudgetExceeded(`maxWallMs exceeded`);
    }
  }
}

export interface RefusalArtifact {
  kind: 'RefusalArtifact';
  reason: string;
}

/**
 * Every graph routes BudgetExceeded through here: a typed refusal, never a
 * degraded answer (§7.9).
 */
export function routeBudgetExceeded(fn: () => unknown): RefusalArtifact {
  try {
    fn();
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      return { kind: 'RefusalArtifact', reason: 'BUDGET_EXCEEDED' };
    }
    throw e;
  }
  throw new Error('expected BudgetExceeded');
}
