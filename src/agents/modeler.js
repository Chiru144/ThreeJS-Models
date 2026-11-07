import { Agent, SubAgent, assert } from '../core/agent.js';
import { MODELS } from '../library/models.js';
import { buildModel, measure } from '../core/sandbox.js';

const fnName = (name) => `make${name[0].toUpperCase()}${name.slice(1)}`;

function emitFactory(name, kinds, style = 'realistic') {
  const def = MODELS[name];
  assert(def, `unknown model ${name}`);
  assert(kinds.includes(def.kind), `${name} is a ${def.kind} model`);
  const fn = style === 'stylized' && def.stylizedFn ? def.stylizedFn : def.fn;
  const source = fn.toString();
  return {
    model: name,
    fnName: fn.name,
    style,
    source,
    // helpers the factory calls, plus their own dependencies (rigKit -> sculpt)
    needs: ((n) => (n.includes('rigKit') && !n.includes('sculpt') ? [...n, 'sculpt'] : n))(['rng', 'heightAt', 'mergeParts', 'sculpt', 'rigKit', 'surfaceTex', 'grassField'].filter((h) => new RegExp(`\\b${h}\\b`).test(source))),
  };
}

function categoryTest(sample) {
  return () => {
    const { obj } = buildModel(sample, {});
    const s = measure(obj);
    assert(s.finite, `${sample} produced non-finite transforms`);
    assert(s.meshes + (s.points ? 1 : 0) > 0, `${sample} produced no geometry`);
  };
}

const CATEGORY = {
  'primitive-modeler': { kinds: ['primitive'], sample: 'torusKnot', description: 'Box, sphere, cylinder, cone, torus, torus knot, capsule.' },
  'procedural-modeler': { kinds: ['procedural'], sample: 'tree', description: 'Multi-part procedural models: tree, rock, house, car, robot, planet, furniture, lamp, crystal, mushroom.' },
  'parametric-modeler': { kinds: ['parametric'], sample: 'vase', description: 'Lathe/profile-based parametric models (vase).' },
  'environment-modeler': { kinds: ['surface', 'backdrop'], sample: 'stars', description: 'Ground, terrain height-field, water, starfield.' },
  'rigged-modeler': { kinds: ['character', 'creature'], sample: 'human', description: 'Articulated, rigged factories for humans and creature body plans (planned by the character/creature agents).' },
};

export class ModelerAgent extends Agent {
  constructor() {
    super({
      name: 'modeler',
      role: 'Selects and emits the geometry factories each scene object needs.',
      subagents: Object.entries(CATEGORY).map(([name, c]) => new SubAgent({
        name,
        description: c.description,
        run: (input) => (typeof input === 'string' ? emitFactory(input, c.kinds) : emitFactory(input.model, c.kinds, input.style)),
        test: categoryTest(c.sample),
      })),
    });
  }

  subFor(model) {
    const kind = MODELS[model].kind;
    return Object.entries(CATEGORY).find(([, c]) => c.kinds.includes(kind))[0];
  }

  /** Returns factories for every distinct model used, routed to the right sub-agent. */
  async handle(models, ctx, style = 'realistic') {
    const out = [];
    for (const m of new Set(models)) out.push(await this.delegate(this.subFor(m), { model: m, style }, ctx));
    return out;
  }
}
