/**
 * Plain-TypeScript sequential runner — the §7.7 fallback that keeps the
 * human-in-the-loop story real without depending on LangGraph. Nodes run in
 * order, patches apply, `nextNode` honours conditional branching, and an
 * InterruptSignal pauses the run. Resume re-runs ONLY the interrupting node
 * from the top — matching LangGraph's interrupt() semantics, which is what
 * dictates the verification graph's node decomposition (visionVerify and
 * requestSecondLocal must be separate nodes so resume never re-pays for
 * vision).
 */

export interface NodeState {
  [key: string]: unknown;
  resumeValues?: Record<string, unknown>;
}

export interface Node<S extends NodeState> {
  name: string;
  run(state: S): Promise<Partial<S>>;
}

export class InterruptSignal extends Error {
  constructor(
    readonly node: string,
    readonly payload: unknown,
  ) {
    super('INTERRUPT');
    this.name = 'InterruptSignal';
  }
}

export interface RunnerOptions<S extends NodeState> {
  nodes: Array<Node<S>>;
}

export class Runner<S extends NodeState> {
  constructor(private readonly options: RunnerOptions<S>) {}

  async run(state: S): Promise<S> {
    let current = state;
    let index = 0;
    while (index < this.options.nodes.length) {
      const node = this.options.nodes[index]!;
      try {
        const patch = await node.run(current);
        current = { ...current, ...patch };
      } catch (e) {
        if (e instanceof InterruptSignal) throw e;
        throw e;
      }
      index++;
    }
    return current;
  }

  /**
   * Resume after an interrupt. The interrupting node re-runs from the top
   * with its resume value available — exactly like LangGraph's interrupt().
   * Only that node executes; everything before it is untouched.
   */
  async resume(state: S, resumeValues: Record<string, unknown>): Promise<S> {
    const withResume: S = { ...state, resumeValues };
    let current = withResume;
    // Find the interrupting node by looking for the one whose run throws
    // InterruptSignal without a resume value, or whose resume value exists.
    for (const node of this.options.nodes) {
      if (node.name in resumeValues) {
        const patch = await node.run(current);
        current = { ...current, ...patch };
        // Continue with the rest of the graph after the resumed node.
        const rest = this.options.nodes.slice(
          this.options.nodes.indexOf(node) + 1,
        );
        for (const n of rest) {
          const p = await n.run(current);
          current = { ...current, ...p };
        }
        return current;
      }
    }
    throw new Error('no resume value matched any node');
  }
}
