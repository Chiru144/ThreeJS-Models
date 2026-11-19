// Every agent and every sub-agent, tested individually so a failure names
// exactly which piece is broken in the user's environment.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../src/core/orchestrator.js';

const orch = new Orchestrator();

describe('agents and sub-agents', () => {
  for (const agent of Object.values(orch.agents)) {
    describe(`agent: ${agent.name}`, () => {
      test('has a role and at least one sub-agent', () => {
        assert.ok(agent.role);
        assert.ok(agent.subagents.size > 0);
      });
      for (const sub of agent.subagents.values()) {
        test(`sub-agent: ${sub.name}`, async () => {
          const r = await sub.selfTest();
          assert.ok(r.ok, `${agent.name}/${sub.name} failed: ${r.error}`);
        });
      }
    });
  }
});

test('health() reports every agent healthy, including the e2e pipeline', async () => {
  const h = await orch.health();
  assert.equal(h.ok, true, JSON.stringify(h, null, 1));
  assert.equal(h.summary.agents, 16);
  assert.equal(h.summary.subagentsOk, h.summary.subagents);
  assert.ok(h.pipeline.ok);
});

test('delegate() records a trace entry per sub-agent call', async () => {
  const { TaskContext } = await import('../src/core/agent.js');
  const ctx = new TaskContext();
  await orch.agents.planner.handle({ prompt: 'a red box' }, ctx);
  assert.deepEqual(ctx.trace.map((t) => t.sub), ['intent-parser', 'theme-expander', 'spec-normalizer']);
});
