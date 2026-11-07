import { Agent, SubAgent, assert } from '../core/agent.js';

const BODY = {
  rotate: "o.rotation.y += dt * a.speed; break;",
  float: "o.position.y = a.y + Math.sin(w) * a.amp; break;",
  bounce: "o.position.y = a.y + Math.abs(Math.sin(w)) * a.amp; break;",
  orbit: "o.position.x = Math.cos(a.a + w) * a.r; o.position.z = Math.sin(a.a + w) * a.r; break;",
  pulse: "o.scale.setScalar(a.s * (1 + Math.sin(w) * a.amp)); break;",
  sway: "o.rotation.z = Math.sin(w) * a.amp; break;",
};

function bind(spec) {
  const bindings = [];
  for (const o of spec.objects) {
    if (!o.animation) continue;
    const target = o.count > 1 && !o.instanced ? 'each' : o.instanced ? 'group' : 'object';
    // A whole instanced ring "orbiting" = spinning the group around the scene centre.
    const type = target === 'group' && o.animation.type === 'orbit' ? 'rotate' : o.animation.type;
    bindings.push({ id: o.id, ...o.animation, type, target });
  }
  return bindings;
}

function emitUpdate(bindings) {
  if (!bindings.length) return '  function update() {}\n';
  const types = [...new Set(bindings.map((b) => b.type))];
  return `  function update(t, dt) {
    for (const a of anims) {
      const o = a.o, w = t * a.speed + a.phase;
      switch (a.type) {
${types.map((t) => `        case '${t}': ${BODY[t]}`).join('\n')}
      }
    }
  }
`;
}

export class AnimationAgent extends Agent {
  constructor() {
    super({
      name: 'animation',
      role: 'Binds motion (rotate, float, orbit, pulse, sway, bounce) and emits a compact update loop.',
      subagents: [
        new SubAgent({
          name: 'motion-binder',
          description: 'Decides per-object vs per-group motion with phase offsets.',
          run: (spec) => bind(spec),
          test: () => {
            const b = bind({ objects: [{ id: 'a', count: 5, instanced: false, animation: { type: 'float', speed: 1, amp: 0.2 } }, { id: 'b', count: 1 }] });
            assert(b.length === 1 && b[0].target === 'each', 'bind');
          },
        }),
        new SubAgent({
          name: 'loop-emitter',
          description: 'Emits an update(t, dt) containing only the motion types in use.',
          run: (bindings) => emitUpdate(bindings),
          test: () => {
            const src = emitUpdate([{ type: 'orbit' }]);
            assert(src.includes("case 'orbit'") && !src.includes("case 'float'"), 'prune');
            // eslint-disable-next-line no-new-func
            new Function(`const anims=[];${src}`);
          },
        }),
      ],
    });
  }

  async handle(spec, ctx) {
    const bindings = await this.delegate('motion-binder', spec, ctx);
    const update = await this.delegate('loop-emitter', bindings, ctx);
    return { bindings, update };
  }
}
