import { Agent, SubAgent, assert } from '../core/agent.js';
import { ANIMATIONS } from '../library/presets.js';

const BODY = {
  rotate: "o.rotation.y += dt * a.speed; break;",
  float: "o.position.y = a.y + Math.sin(w) * a.amp; break;",
  bounce: "o.position.y = a.y + Math.abs(Math.sin(w)) * a.amp; break;",
  orbit: "o.position.x = Math.cos(a.a + w) * a.r; o.position.z = Math.sin(a.a + w) * a.r; break;",
  pulse: "o.scale.setScalar(a.s * (1 + Math.sin(w) * a.amp)); break;",
  sway: "o.rotation.z = Math.sin(w) * a.amp; break;",
};

const RIG_ONLY = "a.rig?.(w, a.type); break;";
const LOCOMOTION = `{
          if (a.R) {
            const th = a.a + (t * a.speed * a.lin) / a.R;
            o.position.x = Math.cos(th) * a.R; o.position.z = Math.sin(th) * a.R; o.rotation.y = -th;
          }
          if (a.type === 'fly') o.position.y = a.y + a.lift + Math.sin(w * 0.5) * a.lift * 0.1;
          else if (a.type === 'swim') o.position.y = a.y + a.lift * 0.5 + Math.sin(w * 0.7) * a.lift * 0.08;
          a.rig?.(w, a.type); break;
        }`;

function bind(spec, ctx) {
  const bindings = [];
  for (const o of spec.objects) {
    if (!o.animation) continue;
    if (ANIMATIONS[o.animation.type]?.rig && o.instanced) {
      ctx?.note(`${o.id}: ${o.count} instanced copies stay posed; rig animation needs ≤ 60 copies.`);
      continue;
    }
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
  const simple = types.filter((t) => BODY[t]);
  const rigOnly = types.filter((t) => ANIMATIONS[t]?.rig && !ANIMATIONS[t].locomotion);
  const moving = types.filter((t) => ANIMATIONS[t]?.locomotion);
  const cases = simple.map((t) => `        case '${t}': ${BODY[t]}`);
  if (rigOnly.length) cases.push(`        ${rigOnly.map((t) => `case '${t}':`).join(' ')} ${RIG_ONLY}`);
  if (moving.length) cases.push(`        ${moving.map((t) => `case '${t}':`).join(' ')} ${LOCOMOTION}`);
  return `  function update(t, dt) {
    for (const a of anims) {
      const o = a.o, w = t * a.speed + a.phase;
      switch (a.type) {
${cases.join('\n')}
      }
    }
  }
`;
}

/** Speeds (m/s) for locomotion types, embedded in generated code when used. */
export const LOCOMOTION_SPEEDS = Object.fromEntries(Object.entries(ANIMATIONS).filter(([, a]) => a.locomotion).map(([k, a]) => [k, a.locomotion]));

export class AnimationAgent extends Agent {
  constructor() {
    super({
      name: 'animation',
      role: 'Binds motion (rotate, float, orbit, pulse, sway, bounce) and emits a compact update loop.',
      subagents: [
        new SubAgent({
          name: 'motion-binder',
          description: 'Decides per-object vs per-group motion with phase offsets.',
          run: (spec, ctx) => bind(spec, ctx),
          test: () => {
            const b = bind({ objects: [{ id: 'a', count: 5, instanced: false, animation: { type: 'float', speed: 1, amp: 0.2 } }, { id: 'b', count: 1 }, { id: 'c', count: 200, instanced: true, animation: { type: 'walk' } }] });
            assert(b.length === 1 && b[0].target === 'each', 'bind (rig motion dropped on instanced crowds)');
          },
        }),
        new SubAgent({
          name: 'loop-emitter',
          description: 'Emits an update(t, dt) containing only the motion types in use.',
          run: (bindings) => emitUpdate(bindings),
          test: () => {
            const src = emitUpdate([{ type: 'orbit' }]);
            assert(src.includes("case 'orbit'") && !src.includes("case 'float'"), 'prune');
            const rig = emitUpdate([{ type: 'walk' }, { type: 'wave' }, { type: 'float' }]);
            assert(rig.includes("case 'walk':") && rig.includes("case 'wave':") && rig.includes('a.rig?.('), 'rig cases');
            // eslint-disable-next-line no-new-func
            new Function(`const anims=[];${src}${rig.replace('function update', 'function update2')}`);
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
