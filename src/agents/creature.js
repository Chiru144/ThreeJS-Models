// Creature agent: plans animals and fantasy creatures — species & body plan,
// morphology, coat/colouring, behaviour/gait — then inspects the rigged result.
import { Agent, SubAgent, assert } from '../core/agent.js';
import { SPECIES } from '../library/creatures.js';
import { MODELS, sanitizeParams } from '../library/models.js';
import { COLORS, resolveColor, MATERIAL_WORDS } from '../library/materials.js';
import { buildModel, measure } from '../core/sandbox.js';

/** Belly a little lighter than the requested coat colour. */
class Color3Mix {
  constructor(c) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; const l = (x) => Math.round(x + (255 - x) * 0.45); this.lighter = (l(r) << 16) | (l(g) << 8) | l(b); }
}

const PLAN_MODELS = new Set(['quadruped', 'bird', 'fish', 'serpent', 'arthropod']);
const COLOR_RE = `(${Object.keys(COLORS).join('|')}|golden)`;
const col = (w) => resolveColor(w === 'golden' ? 'gold' : w);

// Behaviours each body plan can perform; anything else is mapped to the closest.
const GAITS = {
  quadruped: { ok: ['idle', 'walk', 'run'], map: { swim: 'walk', slither: 'walk', dance: 'idle', wave: 'idle', bounce: 'run' } },
  bird: { ok: ['idle', 'walk', 'fly'], map: { run: 'walk', swim: 'walk', float: 'fly', dance: 'walk' } },
  fish: { ok: ['idle', 'swim'], map: { walk: 'swim', run: 'swim', fly: 'swim', float: 'swim', slither: 'swim' } },
  serpent: { ok: ['idle', 'slither'], map: { walk: 'slither', run: 'slither', swim: 'slither' } },
  arthropod: { ok: ['idle', 'walk'], map: { run: 'walk', slither: 'walk' } },
};

function classify({ model, params = {}, description = '' }) {
  assert(PLAN_MODELS.has(model), `${model} is not a creature body plan`);
  const t = ` ${description.toLowerCase()} `;
  let species = params.species && SPECIES[params.species] ? params.species : MODELS[model].params.species.default;
  // multi-word species named in the text ("polar bear", "giant spider") beat the alias match
  for (const name of Object.keys(SPECIES).filter((n) => n.includes(' '))) if (t.includes(name)) species = name;
  return { species, plan: SPECIES[species].plan };
}

function planMorphology({ species, text, explicit }) {
  const base = { ...SPECIES[species] };
  delete base.plan;
  const m = { species, ...base };
  const t = ` ${text} `;
  let scale = 1;
  if (/\b(baby|young|cub|foal|calf|kitten|puppy|piglet|lamb|chick|hatchling|juvenile)\b/.test(t) && species !== 'puppy') {
    scale = 0.5;
    if (m.headLen) { m.headLen *= 1.3; m.headH *= 1.3; }
    if (m.legLen) m.legLen *= 0.9;
  }
  if (/\b(winged|with wings)\b/.test(t) && !m.wings && base.bodyLen) { m.wings = species === 'dragon' ? 'membrane' : 'feather'; m.wingSpan = m.wingSpan ?? base.bodyLen * 1.1; }
  if (/\b(horned|with horns)\b/.test(t) && !m.horns && base.bodyLen) m.horns = 'short';
  if (/\bspiky|spiked\b/.test(t) && base.bodyLen) m.spikes = true;
  if (/\b(fluffy|furry|bushy[- ]tailed)\b/.test(t) && base.tail === 'thin') m.tail = 'bushy';
  if (/\b(long[- ]necked)\b/.test(t) && m.neckLen) m.neckLen *= 1.8;
  if (/\b(long[- ]legged)\b/.test(t) && m.legLen) m.legLen *= 1.4;
  if (/\b(fat|chubby|plump|round)\b/.test(t) && m.bodyW) { m.bodyW *= 1.25; m.bodyH *= 1.15; }
  if (/\b(skinny|thin|slender|lean)\b/.test(t) && m.bodyW) { m.bodyW *= 0.82; m.bodyH *= 0.9; }
  return { params: { ...m, ...explicit }, scale };
}

function planCoat({ species, text, explicit }) {
  const sp = SPECIES[species];
  const t = ` ${text} `;
  const out = {};
  const main = sp.plan === 'bird' || sp.plan === 'fish' || sp.plan === 'serpent' || sp.plan === 'arthropod' ? 'body' : 'coat';
  const second = sp.plan === 'quadruped' ? 'accent' : sp.plan === 'bird' ? 'wing' : sp.plan === 'fish' ? 'fin' : 'accent';
  const two = t.match(new RegExp(`\\b${COLOR_RE}\\s+and\\s+${COLOR_RE}\\b`));
  const one = t.match(new RegExp(`\\b${COLOR_RE}(?:[- ](?:furred|haired|feathered|scaled|coloured|colored))?\\s+(?:[a-z]+\\s+)?(?:${Object.keys(SPECIES).join('|')}|[a-z]+s?)\\b`));
  if (two) { out[main] = col(two[1]); out[second] = col(two[2]); if (sp.plan === 'quadruped' && !sp.stripes && !sp.spots) out.spots = 6; }
  else if (one) out[main] = col(one[1]);
  const spotted = t.match(new RegExp(`\\b(?:with\\s+)?(?:${COLOR_RE}\\s+)?(spots|spotted|patches|dappled)\\b`));
  if (spotted) { out.spots = sp.plan === 'fish' ? 6 : 8; if (spotted[1]) out[sp.plan === 'fish' ? 'spotColor' : 'accent'] = col(spotted[1]); }
  const striped = t.match(new RegExp(`\\b(?:with\\s+)?(?:${COLOR_RE}\\s+)?(stripes|striped|stripy|banded)\\b`));
  if (striped) { if (sp.plan === 'quadruped') out.stripes = 9; else if (sp.plan === 'fish') out.stripes = 3; else out.bands = 12; if (striped[1]) out[sp.plan === 'fish' ? 'stripeColor' : 'accent'] = col(striped[1]); }
  const eyes = t.match(new RegExp(`\\b${COLOR_RE}[ -](eyes|eyed)\\b`));
  if (eyes) out.eye = col(eyes[1]);
  // a "body" colour on a quadruped with no distinct belly keeps its belly in step
  if (out.coat !== undefined && sp.belly && !two) out.belly = new Color3Mix(out.coat).lighter;
  const preset = Object.entries({ golden: 'gold', gold: 'gold', glass: 'glass', crystal: 'glass', metal: 'metal', metallic: 'metal', chrome: 'chrome', stone: 'stone', marble: 'stone', neon: 'neon', glowing: 'neon', ice: 'ice', icy: 'ice', lava: 'lava' })
    .find(([w]) => new RegExp(`\\b${w}\\b`).test(t) && !new RegExp(`\\b${w}[ -](eyes|eyed)\\b`).test(t));
  return { coat: { ...out, ...explicit }, preset: preset && MATERIAL_WORDS.has(preset[0]) ? preset[1] : preset?.[1] };
}

function planBehavior({ plan, species, object, count }) {
  const g = GAITS[plan];
  let a = object.animation?.type;
  if (/\b(galloping|gallop|charging|stampeding|sprinting|chasing)\b/.test(object.description || '')) a = 'run';
  if (/\b(flying|soaring|gliding|in flight)\b/.test(object.description || '') && (plan === 'bird' || SPECIES[species].wings || object.params?.wings)) a = 'fly';
  if (a === 'fly' && plan === 'quadruped' && !(SPECIES[species].wings || object.params?.wings)) a = 'run';
  if (a === 'fly' && SPECIES[species].flightless) a = 'walk';
  if (a && !g.ok.includes(a) && !(a === 'fly' && plan === 'quadruped')) a = g.map[a] ?? (['rotate', 'float', 'orbit', 'pulse', 'sway', 'bounce'].includes(a) ? a : 'idle');
  if (!a) a = plan === 'fish' && count <= 30 ? 'swim' : count <= 3 ? 'idle' : null;
  return a ? { ...(object.animation || {}), type: a, speed: object.animation?.speed ?? 1 } : null;
}

const inspected = new Map();
function inspect({ model, params }) {
  const key = model + JSON.stringify(params);
  if (inspected.has(key)) return inspected.get(key);
  const { obj } = buildModel(model, params);
  assert(typeof obj.userData.rig === 'function', 'missing rig');
  for (const mode of ['idle', 'walk', 'run', 'fly', 'swim', 'slither']) { obj.userData.rig(0.987, mode); assert(measure(obj).finite, `rig mode ${mode} produced NaN`); }
  obj.userData.rig(0, 'idle');
  const r = measure(obj);
  inspected.set(key, r);
  return r;
}

const hexName = (n) => (typeof n === 'number' ? `#${n.toString(16).padStart(6, '0')}` : '');
function sheet(o, scale) {
  const p = o.params;
  const features = ['wings', 'horns', 'mane', 'lionMane', 'trunk', 'tusks', 'spikes', 'stripes', 'spots', 'bands', 'woolly'].filter((k) => p[k]).map((k) => (k === 'horns' ? `${p.horns} horns` : k === 'lionMane' ? 'mane' : k));
  const colour = p.coat ?? p.body;
  return `${p.species} (${o.model})${scale !== 1 ? ' · young' : ''} · ${hexName(colour)}${features.length ? ` · ${features.join(', ')}` : ''} · ${o.animation?.type ?? 'static'}`;
}

export class CreatureAgent extends Agent {
  constructor() {
    super({
      name: 'creature',
      role: 'Plans animals and fantasy creatures (species, morphology, coat, behaviour) and inspects the rigged result.',
      subagents: [
        new SubAgent({
          name: 'species-classifier',
          description: `${Object.keys(SPECIES).length} species across 5 body plans: quadruped, bird, fish, serpent, arthropod.`,
          run: (o) => classify(o),
          test: () => {
            assert(classify({ model: 'quadruped', params: { species: 'horse' } }).species === 'horse');
            assert(classify({ model: 'quadruped', params: { species: 'bear' }, description: 'a polar bear' }).species === 'polar bear', 'multi-word');
          },
        }),
        new SubAgent({
          name: 'morphology-planner',
          description: 'Body/leg/neck/head proportions, ears, horns, tail, wings, age (baby), build modifiers.',
          run: (input) => planMorphology(input),
          test: () => {
            const r = planMorphology({ species: 'horse', text: 'a baby winged horse', explicit: {} });
            assert(r.scale === 0.5 && r.params.wings === 'feather', JSON.stringify(r));
          },
        }),
        new SubAgent({
          name: 'coat-planner',
          description: 'Coat / plumage / scale colours, spots, stripes, eye colour, material (golden, glass, stone…).',
          run: (input) => planCoat(input),
          test: () => {
            const r = planCoat({ species: 'dog', text: 'a black and white dog with blue eyes', explicit: {} });
            assert(r.coat.coat === COLORS.black && r.coat.accent === COLORS.white && r.coat.eye === COLORS.blue, JSON.stringify(r));
            assert(planCoat({ species: 'cat', text: 'a golden cat statue', explicit: {} }).preset === 'gold', 'preset');
          },
        }),
        new SubAgent({
          name: 'behavior-planner',
          description: 'Gait per body plan: walk/run/fly/swim/slither/idle, with sensible fallbacks.',
          run: (input) => planBehavior(input),
          test: () => {
            assert(planBehavior({ plan: 'fish', species: 'shark', object: {}, count: 1 }).type === 'swim');
            assert(planBehavior({ plan: 'quadruped', species: 'horse', object: { description: 'galloping horse' }, count: 1 }).type === 'run');
            assert(planBehavior({ plan: 'quadruped', species: 'dragon', object: { animation: { type: 'fly' } }, count: 1 }).type === 'fly');
            assert(planBehavior({ plan: 'bird', species: 'penguin', object: { animation: { type: 'fly' } }, count: 1 }).type === 'walk', 'flightless');
          },
        }),
        new SubAgent({
          name: 'rig-inspector',
          description: 'Builds the planned creature in three.js and runs every gait to prove the rig is sound.',
          run: (input) => inspect(input),
          test: () => {
            for (const sp of ['dragon', 'eagle', 'shark', 'cobra', 'scorpion']) {
              const { plan, ...params } = SPECIES[sp];
              const r = inspect({ model: plan, params });
              assert(r.finite && r.meshes > 0 && r.drawCalls <= 40, `${sp}: ${JSON.stringify(r)}`);
            }
          },
        }),
      ],
    });
  }

  async plan(o, ctx) {
    const text = (o.description || '').toLowerCase();
    const explicit = { ...o.params };
    delete explicit.species;
    const { species, plan } = await this.delegate('species-classifier', o, ctx);
    if (plan !== o.model) o.model = plan;
    const morph = await this.delegate('morphology-planner', { species, text, explicit }, ctx);
    const coat = await this.delegate('coat-planner', { species, text, explicit: {} }, ctx);
    o.params = sanitizeParams(o.model, { ...morph.params, ...coat.coat, ...explicit, species, vary: o.count > 1 });
    o.scale *= morph.scale;
    o.animation = await this.delegate('behavior-planner', { plan: o.model, species, object: o, count: o.count }, ctx);
    o.material = coat.preset ? { preset: coat.preset, color: o.material?.color } : {};
    await this.delegate('rig-inspector', { model: o.model, params: o.params }, ctx);
    o.sheet = sheet(o, morph.scale);
    return o;
  }

  async handle(spec, ctx) {
    for (const o of spec.objects) if (PLAN_MODELS.has(o.model)) await this.plan(o, ctx);
    return spec;
  }
}
