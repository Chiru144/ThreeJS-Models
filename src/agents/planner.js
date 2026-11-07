import { Agent, SubAgent, assert } from '../core/agent.js';
import { MODELS, MODEL_ALIASES, sanitizeParams } from '../library/models.js';
import { MATERIAL_WORDS, COLORS, resolveColor, MATERIAL_PRESETS } from '../library/materials.js';
import { LIGHTING, ANIMATIONS, QUALITY } from '../library/presets.js';

const NUM_WORDS = {
  a: 1, an: 1, one: 1, single: 1, two: 2, pair: 2, couple: 2, three: 3, few: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, dozen: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50,
  several: 5, some: 4, many: 15, lots: 20, hundred: 100, hundreds: 200, thousand: 1000, thousands: 2000, dense: 40,
};
const SIZE_WORDS = { tiny: 0.4, small: 0.65, little: 0.65, big: 1.5, large: 1.6, huge: 2.2, giant: 2.6, massive: 3 };
const THEMES = {
  forest: { lighting: 'daylight', ground: 'grass', add: [['tree', 30], ['rock', 8], ['mushroom', 12]] },
  woods: { lighting: 'daylight', ground: 'grass', add: [['tree', 25], ['rock', 6]] },
  village: { lighting: 'daylight', ground: 'grass', add: [['house', 6], ['tree', 14], ['lamp', 4]] },
  town: { lighting: 'daylight', ground: 'grass', add: [['house', 8], ['tree', 10], ['car', 3]] },
  city: { lighting: 'sunset', ground: 'stone', add: [['house', 12], ['car', 6], ['lamp', 6]] },
  desert: { lighting: 'sunset', ground: 'sand', add: [['rock', 14]] },
  winter: { lighting: 'daylight', ground: 'snow', add: [['tree', 18]] },
  snowy: { lighting: 'daylight', ground: 'snow', add: [] },
  space: { lighting: 'space', ground: 'none', add: [['stars', 1]] },
  galaxy: { lighting: 'space', ground: 'none', add: [['stars', 1]] },
  'solar system': { lighting: 'space', ground: 'none', add: [['stars', 1], ['planet', 5]] },
  'asteroid field': { lighting: 'space', ground: 'none', add: [['stars', 1], ['rock', 60]] },
  room: { lighting: 'studio', ground: 'wood', add: [] },
  interior: { lighting: 'studio', ground: 'wood', add: [] },
  'dining room': { lighting: 'studio', ground: 'wood', add: [['table', 1], ['chair', 4], ['vase', 1]] },
  cave: { lighting: 'night', ground: 'stone', add: [['crystal', 20], ['rock', 15]] },
  fantasy: { lighting: 'sunset', ground: 'grass', add: [['crystal', 10], ['mushroom', 15]] },
  farm: { lighting: 'daylight', ground: 'grass', add: [['house', 2], ['cow', 3], ['pig', 3], ['sheep', 5], ['chicken', 6], ['farmer', 1], ['tree', 8]] },
  savanna: { lighting: 'sunset', ground: 'sand', add: [['lion', 2], ['elephant', 2], ['giraffe', 3], ['zebra', 5], ['oak', 6]] },
  safari: { lighting: 'sunset', ground: 'sand', add: [['lion', 2], ['elephant', 2], ['giraffe', 3], ['zebra', 5], ['oak', 6]] },
  jungle: { lighting: 'daylight', ground: 'grass', add: [['oak', 30], ['parrot', 4], ['snake', 2], ['tiger', 1]] },
  underwater: { lighting: 'underwater', ground: 'sand', add: [['fish', 25], ['rock', 12]] },
  aquarium: { lighting: 'underwater', ground: 'sand', add: [['goldfish', 12], ['clownfish', 6], ['rock', 6]] },
  reef: { lighting: 'underwater', ground: 'sand', add: [['clownfish', 12], ['fish', 15], ['rock', 14], ['shark', 1]] },
  medieval: { lighting: 'sunset', ground: 'grass', add: [['knight', 2], ['house', 6], ['horse', 1], ['tree', 10]] },
  castle: { lighting: 'sunset', ground: 'stone', add: [['knight', 3], ['king', 1]] },
  park: { lighting: 'daylight', ground: 'grass', add: [['oak', 12], ['person', 6], ['dog', 2], ['lamp', 4]] },
  crowd: { lighting: 'daylight', ground: 'stone', add: [['person', 30]] },
  street: { lighting: 'sunset', ground: 'stone', add: [['person', 12], ['car', 4], ['lamp', 6], ['house', 6]] },
  zoo: { lighting: 'daylight', ground: 'grass', add: [['elephant', 1], ['giraffe', 1], ['lion', 1], ['zebra', 2], ['penguin', 4], ['person', 6]] },
  graveyard: { lighting: 'night', ground: 'grass', add: [['zombie', 5], ['rock', 12], ['crow', 4]] },
};
const PLURAL_ALIASES = new Set(['people', 'persons', 'men', 'women', 'children', 'kids', 'villagers', 'cattle', 'mice', 'wolves', 'geese', 'fish', 'sheep', 'deer']);
const CONNECTORS = new Set(['on', 'with', 'riding', 'in', 'of', 'beside', 'next', 'to', 'a', 'an', 'the', 'and', 'near', 'holding', 'walking', 'chasing', 'by', 'at', 'under', 'over', 'behind', 'between', 'among', 'while', 'who', 'that']);
const QUALITY_WORDS = {
  low: ['low poly', 'low-poly', 'lowpoly', 'mobile', 'fast', 'lightweight', 'performant'],
  high: ['high quality', 'realistic', 'detailed', 'photoreal', 'photorealistic', '4k', 'cinematic', 'best quality'],
};

const singular = (w) => (w.endsWith('ies') ? `${w.slice(0, -3)}y` : w.endsWith('ves') ? `${w.slice(0, -3)}f`
  : /(sh|ch|x|ss)es$/.test(w) ? w.slice(0, -2) : w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w);

/** Find the longest alias (1-3 words) at token i. */
function matchModel(tokens, i) {
  for (let len = 3; len >= 1; len--) {
    if (i + len > tokens.length) continue;
    const phrase = tokens.slice(i, i + len).join(' ');
    const hit = MODEL_ALIASES.get(phrase) || MODEL_ALIASES.get(singular(phrase));
    if (hit) return { ...hit, len, plural: singular(phrase) !== phrase && !MODEL_ALIASES.has(phrase) };
  }
  return null;
}

function parseIntent(prompt) {
  const text = ` ${String(prompt).toLowerCase().replace(/[^a-z0-9#\s,.;-]/g, ' ')} `;
  const found = (list) => list.find((w) => new RegExp(`\\b${w}\\b`).test(text));
  const out = { objects: [], lighting: null, quality: null, theme: null, ground: null, unknown: [] };

  for (const [name, l] of Object.entries(LIGHTING)) if (!out.lighting && found(l.words)) out.lighting = name;
  for (const [q, words] of Object.entries(QUALITY_WORDS)) if (!out.quality && found(words)) out.quality = q;
  for (const t of Object.keys(THEMES).sort((a, b) => b.length - a.length)) if (!out.theme && found([t])) out.theme = t;
  if (found(['terrain', 'hills', 'hilly', 'mountains', 'landscape'])) out.terrain = true;
  for (const g of ['sand', 'snow', 'grass', 'stone']) if (!out.ground && found([`${g}y? ground`, `${g}y? floor`])) out.ground = g;

  // keep colour pairs together: "black and white horse" must not split at "and"
  const colorPair = new RegExp(`\\b(${Object.keys(COLORS).join('|')}) and (${Object.keys(COLORS).join('|')})\\b`, 'g');
  const segments = text.replace(colorPair, '$1_and_$2').split(/,|;|\.\s|\band\b|\bplus\b|\bnext to\b|\bbeside\b|\bnear\b|\baround\b|\bon top of\b|\bsurrounded by\b/);
  let prevObj = null;
  for (const seg of segments) {
    const tokens = seg.trim().split(/\s+/).filter(Boolean);
    const attrs = { color: undefined, preset: undefined, animation: undefined, scale: undefined };
    let pendingCount, lastObj;
    const found = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      const two = `${t} ${tokens[i + 1] || ''}`;
      if (/^\d+$/.test(t)) { pendingCount = Math.min(+t, 5000); continue; }
      if (t in NUM_WORDS && !MODEL_ALIASES.has(t)) { pendingCount = NUM_WORDS[t]; continue; }
      if (t in SIZE_WORDS) { attrs.scale = SIZE_WORDS[t]; continue; }
      if (MATERIAL_WORDS.has(two)) { attrs.preset = MATERIAL_WORDS.get(two); i++; continue; }
      const mm = matchModel(tokens, i);
      // "baby horse", "giant spider", "stone golem": a modifier, not an object of its own
      const nextModel = mm && matchModel(tokens, i + mm.len);
      const modifier = mm && nextModel && nextModel.model !== mm.model && (mm.model === 'human' || MATERIAL_WORDS.has(t));
      if (mm && !modifier) {
        const word = tokens.slice(i, i + mm.len).join(' ');
        const count = pendingCount ?? (mm.plural || PLURAL_ALIASES.has(word) ? 6 : 1);
        lastObj = { model: mm.model, count, params: { ...mm.params }, ...attrs };
        out.objects.push(lastObj);
        found.push({ obj: lastObj, start: i, end: i + mm.len });
        pendingCount = undefined;
        i += mm.len - 1;
        // "saturn planet", "pine tree": swallow a following word naming the same model
        const nx = matchModel(tokens, i + 1);
        if (nx && nx.model === mm.model) i += nx.len;
        continue;
      }
      // material words first: "gold" / "silver" are both, and the preset carries the colour
      if (MATERIAL_WORDS.has(t)) { attrs.preset = MATERIAL_WORDS.get(t); if (lastObj && !lastObj.preset) lastObj.preset = attrs.preset; continue; }
      if (t in COLORS) { attrs.color = t; if (lastObj && !lastObj.color) lastObj.color = t; continue; }
      const anim = Object.entries(ANIMATIONS).find(([, a]) => a.words.includes(t));
      if (anim) { attrs.animation = anim[0]; if (lastObj && !lastObj.animation) lastObj.animation = anim[0]; continue; }
    }
    // Per-object free-text description for the specialist agents: adjectives just before
    // an object belong to it; everything after it (until the next object's adjectives) too.
    found.forEach((f, k) => {
      let from = f.start;
      const floor = k ? found[k - 1].end : 0;
      while (from > floor && !CONNECTORS.has(tokens[from - 1]) && !/^\d+$/.test(tokens[from - 1])) from--;
      if (k === 0) from = 0;
      f.from = from;
    });
    found.forEach((f, k) => { f.obj.description = tokens.slice(f.from, k + 1 < found.length ? found[k + 1].from : tokens.length).join(' ').replace(/_and_/g, ' and '); });
    if (!found.length && prevObj && seg.trim()) {
      prevObj.description = `${prevObj.description || ''} ${seg.trim().replace(/_and_/g, ' and ')}`.trim();
      if (!prevObj.animation && attrs.animation) prevObj.animation = attrs.animation;
    }
    if (found.length) prevObj = found[found.length - 1].obj;
  }
  return out;
}

function expandTheme(intent) {
  const theme = intent.theme && THEMES[intent.theme];
  const objects = [...intent.objects];
  if (theme) {
    const identity = (m, params = {}) => {
      const a = MODEL_ALIASES.get(m);
      return `${a?.model ?? m}:${params.species ?? params.archetype ?? a?.params.species ?? a?.params.archetype ?? ''}`;
    };
    const have = new Set(objects.map((o) => identity(o.model, o.params).replace(/:(person|man|woman|child)$/, ':person')));
    for (const [model, count] of theme.add) {
      const id = identity(model).replace(/:(person|man|woman|child)$/, ':person');
      if (!have.has(id)) { objects.push({ model: MODEL_ALIASES.get(model)?.model ?? model, count, params: { ...(MODEL_ALIASES.get(model)?.params || {}) } }); have.add(id); }
    }
  }
  const space = intent.lighting === 'space' || theme?.lighting === 'space' || objects.some((o) => o.model === 'planet');
  const lighting = intent.lighting || theme?.lighting || (space ? 'space' : objects.some((o) => ['tree', 'house', 'rock', 'car', 'lamp'].includes(o.model)) ? 'daylight' : 'studio');
  if (lighting === 'space' && !objects.some((o) => o.model === 'stars')) objects.push({ model: 'stars', count: 1, params: {} });
  if (lighting === 'night') for (const o of objects) if (o.model === 'house') o.params.lit = true;
  if (intent.terrain && !objects.some((o) => o.model === 'terrain')) objects.push({ model: 'terrain', count: 1, params: { amp: 2 } });
  if (lighting === 'underwater') for (let i = objects.length - 1; i >= 0; i--) if (objects[i].model === 'water') objects.splice(i, 1);
  const ground = space ? 'none' : lighting === 'underwater' ? intent.ground || 'sand' : intent.ground || theme?.ground || (lighting === 'studio' ? 'matte' : lighting === 'neon' ? 'metal' : 'grass');
  if (!objects.some((o) => !['stars', 'ground', 'terrain', 'water'].includes(o.model))) {
    objects.push({ model: 'torusKnot', count: 1, params: {}, preset: 'metal', color: 'gold', defaulted: true });
  }
  return { objects, lighting, ground, quality: intent.quality || 'medium' };
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48).replace(/-+$/, '') || 'scene';

/** Validate + fill defaults. Accepts both planner output and user-written specs. */
function normalizeSpec(raw, ctx) {
  assert(raw && Array.isArray(raw.objects), 'spec.objects must be an array');
  const quality = QUALITY[raw.quality] ? raw.quality : 'medium';
  const lighting = LIGHTING[raw.lighting?.preset ?? raw.lighting] ? (raw.lighting?.preset ?? raw.lighting) : 'studio';
  const objects = [];
  raw.objects.forEach((o, i) => {
    const key = String(o.model ?? '').toLowerCase();
    const alias = MODEL_ALIASES.get(key) || MODEL_ALIASES.get(singular(key));
    if (!alias) { ctx?.warn(`Unknown model "${o.model}" skipped (see forge_catalog).`); return; }
    const model = alias.model;
    const count = Math.max(1, Math.min(5000, Math.round(Number(o.count) || 1)));
    const color = o.color ?? o.material?.color;
    const preset = o.preset ?? o.material?.preset;
    if (color != null && resolveColor(color) === undefined) ctx?.warn(`Unknown colour "${color}" on ${model}; using default.`);
    if (preset && !MATERIAL_PRESETS[preset]) ctx?.warn(`Unknown material preset "${preset}" on ${model}; using default.`);
    const anim = typeof o.animation === 'string' ? { type: o.animation } : o.animation;
    objects.push({
      id: o.id || `${model}${i + 1}`,
      model,
      kind: MODELS[model].kind,
      count: MODELS[model].kind === 'surface' || model === 'stars' ? 1 : count,
      params: sanitizeParams(model, { ...alias.params, ...o.params }),
      material: { color: resolveColor(color), preset: MATERIAL_PRESETS[preset] ? preset : undefined },
      animation: anim && ANIMATIONS[anim.type] ? { type: anim.type, speed: Number(anim.speed) || ANIMATIONS[anim.type].speed, amp: Number(anim.amp) || ANIMATIONS[anim.type].amp } : null,
      scale: Math.max(0.05, Math.min(100, Number(o.scale) || 1)),
      position: Array.isArray(o.position) && o.position.length === 3 && o.position.every(Number.isFinite) ? o.position : null,
      rotationY: Number(o.rotationY) || 0,
      ...(o.description ? { description: String(o.description).slice(0, 400) } : {}),
    });
  });
  assert(objects.length > 0, 'spec has no valid objects');
  const env = raw.environment || {};
  return {
    title: String(raw.title || 'Three.js Scene').slice(0, 80),
    slug: slug(raw.title || 'scene'),
    quality,
    seed: Number.isInteger(raw.seed) ? raw.seed : 1337,
    lighting: { preset: lighting, shadows: raw.lighting?.shadows ?? QUALITY[quality].shadows },
    environment: {
      ground: env.ground ?? raw.ground ?? 'grass',
      fog: env.fog ?? true,
      background: resolveColor(env.background),
    },
    objects,
  };
}

export class PlannerAgent extends Agent {
  constructor() {
    super({
      name: 'planner',
      role: 'Turns a natural-language request (or a raw spec) into a validated scene spec.',
      subagents: [
        new SubAgent({
          name: 'intent-parser',
          description: 'Extracts models, counts, colours, materials, motion, lighting and quality words.',
          run: (prompt) => parseIntent(prompt),
          test: () => {
            const r = parseIntent('three red metal cars and 20 floating crystals at night');
            assert(r.objects.length === 2, 'expected 2 objects');
            assert(r.objects[0].model === 'car' && r.objects[0].count === 3 && r.objects[0].color === 'red' && r.objects[0].preset === 'metal', 'car parse');
            assert(r.objects[1].model === 'crystal' && r.objects[1].count === 20 && r.objects[1].animation === 'float', 'crystal parse');
            assert(r.lighting === 'night', 'lighting parse');
          },
        }),
        new SubAgent({
          name: 'theme-expander',
          description: 'Expands themes (forest, village, space, desert…) and picks lighting/ground defaults.',
          run: (intent) => expandTheme(intent),
          test: () => {
            const r = expandTheme(parseIntent('a forest'));
            assert(r.objects.some((o) => o.model === 'tree') && r.lighting === 'daylight', 'forest theme');
            const s = expandTheme(parseIntent('a planet'));
            assert(s.lighting === 'space' && s.ground === 'none' && s.objects.some((o) => o.model === 'stars'), 'space theme');
          },
        }),
        new SubAgent({
          name: 'spec-normalizer',
          description: 'Validates any spec, resolves aliases, clamps params, fills defaults.',
          run: (raw, ctx) => normalizeSpec(raw, ctx),
          test: () => {
            const s = normalizeSpec({ objects: [{ model: 'Cubes', count: 99999, params: { size: -5 } }, { model: 'nope' }] });
            assert(s.objects.length === 1 && s.objects[0].model === 'box' && s.objects[0].count === 5000 && s.objects[0].params.size === 0.1, 'normalize');
          },
        }),
      ],
    });
  }

  async handle({ prompt, spec }, ctx) {
    if (spec) return this.delegate('spec-normalizer', spec, ctx);
    const intent = await this.delegate('intent-parser', prompt, ctx);
    const plan = await this.delegate('theme-expander', intent, ctx);
    if (plan.objects.some((o) => o.defaulted)) ctx.warn('No known model words found; used a gold torus knot. Call forge_catalog for model names.');
    let title = String(prompt).trim().replace(/\s+/g, ' ');
    if (title.length > 60) title = title.slice(0, 60).replace(/\s+\S*$/, '');
    return this.delegate('spec-normalizer', {
      title: title.charAt(0).toUpperCase() + title.slice(1),
      quality: plan.quality,
      lighting: plan.lighting,
      environment: { ground: plan.ground },
      objects: plan.objects.map((o) => ({ model: o.model, count: o.count, params: o.params, color: o.color, preset: o.preset, animation: o.animation, scale: o.scale, description: o.description })),
    }, ctx);
  }
}
