import { Agent, SubAgent, assert } from '../core/agent.js';
import { MODELS } from '../library/models.js';
import { QUALITY } from '../library/presets.js';
import { buildModel, measure } from '../core/sandbox.js';

const costCache = new Map();
function estimateCost({ model, params }) {
  const key = `${model}:${JSON.stringify(params)}`;
  if (!costCache.has(key)) {
    const { obj } = buildModel(model, params);
    const s = measure(obj);
    costCache.set(key, { triangles: s.triangles, parts: s.drawCalls, lights: s.lights });
  }
  return costCache.get(key);
}

function adviseInstancing(o, quality) {
  const q = QUALITY[quality];
  if (o.count < 2 || o.kind === 'surface' || o.kind === 'backdrop') return { instanced: false };
  if (o.model === 'lamp' && o.count <= 12) return { instanced: false, reason: 'each lamp keeps its PointLight' };
  if (o.count < q.instanceThreshold) return { instanced: false };
  if (o.animation && o.count <= 60) return { instanced: false, reason: 'individually animated' };
  return { instanced: true, reason: o.animation ? 'large animated group: motion applied to the whole group' : undefined };
}

/** Plans per-object instancing and trims counts that blow the triangle budget. */
function planBudget({ objects, quality }, ctx) {
  const q = QUALITY[quality];
  let tris = 0, draws = 0, lights = 0;
  for (const o of objects) {
    tris += o.cost.triangles * o.count;
    draws += o.cost.parts * (o.instanced ? 1 : o.count);
    lights += o.cost.lights * (o.instanced ? 0 : o.count);
  }
  if (tris > q.triBudget) {
    const k = q.triBudget / tris;
    for (const o of objects) {
      if (o.count > 1) {
        const before = o.count;
        o.count = Math.max(1, Math.floor(o.count * k));
        if (o.count !== before) ctx?.warn(`${o.id}: count ${before}→${o.count} to stay within the ${quality} triangle budget (${q.triBudget.toLocaleString('en-US')}).`);
      }
    }
    tris = objects.reduce((s, o) => s + o.cost.triangles * o.count, 0);
  }
  if (draws > q.drawBudget) {
    const heavy = objects.filter((o) => !o.instanced && o.count > 3).map((o) => `${o.id}×${o.count}`).join(', ');
    ctx?.warn(`~${draws} draw calls exceeds the ${quality} budget (${q.drawBudget})${heavy ? `: individually animated ${heavy}; fewer copies or no animation lets them instance` : ''}.`);
  }
  if (lights > 8) ctx?.warn(`${lights} point lights from lamps: expensive on mobile. Consider fewer lamps or quality "low".`);
  return { triangles: tris, drawCalls: draws };
}

export class OptimizerAgent extends Agent {
  constructor() {
    super({
      name: 'optimizer',
      role: 'Measures real geometry cost and applies instancing and budget limits.',
      subagents: [
        new SubAgent({
          name: 'cost-estimator',
          description: 'Builds each model with real three.js to count triangles, parts and lights.',
          run: (o) => estimateCost(o),
          test: () => {
            const c = estimateCost({ model: 'box', params: {} });
            assert(c.triangles === 12 && c.parts === 1, `box cost ${JSON.stringify(c)}`);
          },
        }),
        new SubAgent({
          name: 'instancing-advisor',
          description: 'Turns repeated objects into InstancedMesh (one draw call per part).',
          run: ({ object, quality }) => adviseInstancing(object, quality),
          test: () => {
            assert(adviseInstancing({ count: 50, kind: 'procedural' }, 'medium').instanced === true, 'instance many');
            assert(adviseInstancing({ count: 1, kind: 'procedural' }, 'medium').instanced === false, 'single');
            assert(adviseInstancing({ count: 10, kind: 'procedural', animation: { type: 'float' } }, 'medium').instanced === false, 'animated');
          },
        }),
        new SubAgent({
          name: 'budget-planner',
          description: 'Keeps triangles / draw calls / lights inside the quality budget.',
          run: (input, ctx) => planBudget(input, ctx),
          test: () => {
            const objs = [{ id: 'x', count: 1000, instanced: true, cost: { triangles: 10000, parts: 1, lights: 0 } }];
            const r = planBudget({ objects: objs, quality: 'low' });
            assert(objs[0].count === 15 && r.triangles <= QUALITY.low.triBudget, 'budget trim');
          },
        }),
      ],
    });
  }

  async handle(spec, ctx) {
    for (const o of spec.objects) {
      o.cost = await this.delegate('cost-estimator', o, ctx);
      const adv = await this.delegate('instancing-advisor', { object: o, quality: spec.quality }, ctx);
      o.instanced = adv.instanced;
      if (adv.reason && adv.instanced) ctx.note(`${o.id}: ${adv.reason}.`);
    }
    return this.delegate('budget-planner', spec, ctx);
  }
}

export { MODELS };
