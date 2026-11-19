// Surfacing agent: what makes a model hold up close. Plans real fur (shell fur)
// per species and budget; micro-detail (pores, weave, scales, bark, grain) is
// applied by the factories through the detailize() shader helper.
import { Agent, SubAgent, assert } from '../core/agent.js';
import { buildModel } from '../core/sandbox.js';

// fur length as a fraction of body height, and strand density (strands across the body height)
const GROOM = {
  horse: [0.012, 150], pony: [0.03, 110], zebra: [0.012, 150], unicorn: [0.015, 150], pegasus: [0.015, 150], cow: [0.02, 130], bull: [0.02, 130], deer: [0.025, 130], goat: [0.05, 100], giraffe: [0.012, 160],
  dog: [0.07, 90], puppy: [0.11, 70], wolf: [0.09, 85], fox: [0.11, 80], cat: [0.09, 90], lion: [0.04, 110], tiger: [0.045, 110], bear: [0.09, 80], 'polar bear': [0.09, 80],
  rabbit: [0.13, 70], mouse: [0.11, 70], sheep: [0.1, 55],
};
const SHELLS = { low: 0, medium: 7, high: 12 };

function planFur({ object, quality }) {
  const g = GROOM[object.params.species];
  if (!g || object.params.scaly || object.model !== 'quadruped') return null;
  if (object.material?.preset) return null; // a gold / glass / stone animal is a statue: no fur
  const shells = object.count > 3 || object.instanced ? 0 : SHELLS[quality] ?? 7;
  if (!shells) return null;
  const BH = (object.params.bodyH ?? 0.3);
  return { len: +(BH * g[0] * 0.8).toFixed(5), density: +(g[1] * 1.7 / BH).toFixed(2), shells, tip: object.params.woolly ? 1.05 : 1.12, rootShade: object.params.woolly ? 0.75 : 0.62 };
}

const DETAIL_BY_KIND = {
  human: 'skin pores, fabric weave / knit, leather grain',
  quadruped: 'scales on reptiles, keratin grain on hooves and horns, shell fur on mammals',
  tree: 'bark fibre', rock: 'stone grain', blueprint: 'per material: wood grain, brick, plaster, brushed metal, leather, fabric weave',
};

export class SurfacingAgent extends Agent {
  constructor() {
    super({
      name: 'surfacing',
      role: 'Close-up quality: plans shell fur per species and budget, and procedural micro-detail (pores, weave, scales, bark, grain).',
      subagents: [
        new SubAgent({
          name: 'fur-groomer',
          description: `Shell fur for ${Object.keys(GROOM).length} species: length and density from the body size; hero animals only, by quality.`,
          run: (input) => planFur(input),
          test: () => {
            const cat = planFur({ object: { model: 'quadruped', count: 1, params: { species: 'cat', bodyH: 0.19 } }, quality: 'high' });
            assert(cat && cat.shells === 12 && cat.len > 0.008 && cat.len < 0.03, JSON.stringify(cat));
            assert(planFur({ object: { model: 'quadruped', count: 1, params: { species: 'dragon', scaly: true } }, quality: 'high' }) === null, 'no fur on scales');
            assert(planFur({ object: { model: 'quadruped', count: 30, params: { species: 'sheep' } }, quality: 'high' }) === null, 'herds stay light');
          },
        }),
        new SubAgent({
          name: 'detail-shader',
          description: 'Micro-detail without textures or UVs: normal + roughness perturbation in bind space (follows skinning, fades with distance).',
          run: (model) => DETAIL_BY_KIND[model] || null,
          test: () => {
            const { obj } = buildModel('rock', {});
            assert(obj.material.userData.detail === 'grain' && typeof obj.material.onBeforeCompile === 'function', 'rock should carry stone grain');
            const cat = buildModel('quadruped', { species: 'cat', bodyH: 0.19, bodyLen: 0.48, bodyW: 0.15, legLen: 0.22, fur: { len: 0.015, density: 470, shells: 4 } }).obj;
            let shells = 0; cat.traverse((o) => { if (o.userData.shell === true) shells++; });
            assert(shells === 4, `expected 4 fur shells, got ${shells}`);
          },
        }),
      ],
    });
  }

  async handle(spec, ctx) {
    if (spec.style === 'stylized') return spec;
    for (const o of spec.objects) {
      const fur = await this.delegate('fur-groomer', { object: o, quality: spec.quality }, ctx);
      if (fur) { o.params = { ...o.params, fur }; ctx.note(`${o.id}: ${fur.shells}-shell fur, ${(fur.len * 100).toFixed(1)} cm`); } else if (o.params.fur) { const { fur: _drop, ...rest } = o.params; o.params = rest; }
    }
    return spec;
  }
}
