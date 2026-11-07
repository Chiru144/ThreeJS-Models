// Base classes for the agent hierarchy.
// An Agent owns a set of SubAgents. Each SubAgent does one narrow job and
// ships its own self-test so the whole tree can be health-checked anywhere.

export class SubAgent {
  /**
   * @param {object} def
   * @param {string} def.name
   * @param {string} def.description
   * @param {(input:any, ctx:TaskContext)=>any} def.run
   * @param {()=>any} def.test  Throws (or returns false) on failure.
   */
  constructor({ name, description, run, test }) {
    if (!name || typeof run !== 'function' || typeof test !== 'function') {
      throw new Error(`SubAgent "${name}" needs name, run() and test()`);
    }
    this.name = name;
    this.description = description || '';
    this._run = run;
    this._test = test;
  }

  run(input, ctx) {
    return this._run(input, ctx);
  }

  async selfTest() {
    const t0 = performance.now();
    try {
      const r = await this._test();
      if (r === false) throw new Error('test returned false');
      return { name: this.name, ok: true, ms: +(performance.now() - t0).toFixed(2) };
    } catch (e) {
      return { name: this.name, ok: false, ms: +(performance.now() - t0).toFixed(2), error: e.message };
    }
  }
}

export class Agent {
  constructor({ name, role, subagents = [] }) {
    this.name = name;
    this.role = role;
    this.subagents = new Map(subagents.map((s) => [s.name, s]));
  }

  /** Run one sub-agent and record it in the task trace. */
  async delegate(subName, input, ctx) {
    const sub = this.subagents.get(subName);
    if (!sub) throw new Error(`${this.name}: unknown sub-agent "${subName}"`);
    const t0 = performance.now();
    try {
      return await sub.run(input, ctx);
    } finally {
      ctx?.trace?.push({ agent: this.name, sub: subName, ms: +(performance.now() - t0).toFixed(2) });
    }
  }

  /** Override: the agent's own work, usually a sequence of delegate() calls. */
  async handle(_input, _ctx) {
    throw new Error(`${this.name}.handle() not implemented`);
  }

  async selfTest() {
    const subs = [];
    for (const s of this.subagents.values()) subs.push(await s.selfTest());
    return { agent: this.name, ok: subs.every((s) => s.ok), subagents: subs };
  }

  describe() {
    return {
      agent: this.name,
      role: this.role,
      subagents: [...this.subagents.values()].map((s) => ({ name: s.name, description: s.description })),
    };
  }
}

/** Per-task state passed through the pipeline. */
export class TaskContext {
  constructor(task = {}) {
    this.task = task;
    this.trace = [];
    this.warnings = [];
    this.notes = [];
  }
  warn(msg) {
    if (!this.warnings.includes(msg)) this.warnings.push(msg);
  }
  note(msg) {
    if (!this.notes.includes(msg)) this.notes.push(msg);
  }
}

export function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'assertion failed');
}
