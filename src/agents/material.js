import { Agent, SubAgent, assert } from '../core/agent.js';
import { MATERIAL_PRESETS, resolveColor } from '../library/materials.js';

// Which preset a colour-only request maps to, per model.
const MAIN_PRESET = {
  car: 'carpaint', vase: 'ceramic', crystal: 'glass', table: 'wood', chair: 'wood', rock: 'stone',
  robot: 'metal', lamp: 'metal', water: 'water', tree: 'matte', mushroom: 'plastic', house: 'matte', planet: 'matte',
};
const GROUND = { grass: 'grass', sand: 'sand', snow: 'snow', stone: 'stone', wood: 'wood', matte: 'matte', metal: 'metal' };
const GROUND_COLORS = { matte: 0x25262c, metal: 0x16121f, wood: 0x6b4a2f, stone: 0x77736d };

function resolveMaterial({ model, preset, color }) {
  if (!preset && color == null) return null; // keep the model's own art-directed materials
  const name = preset || MAIN_PRESET[model] || 'plastic';
  const p = MATERIAL_PRESETS[name] || MATERIAL_PRESETS.plastic;
  const props = { ...p.props };
  if (color != null) props.color = color;
  if (p.emissive) {
    props.color = props.color ?? 0xff2bd6;
    props.emissive = props.color;
  }
  if (model === 'tree' || model === 'rock') props.flatShading = true;
  return { type: p.type, props };
}

const stableKey = (m) => {
  const canon = `${m.type}|${Object.entries(m.props).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',')}`;
  let h = 5381;
  for (let i = 0; i < canon.length; i++) h = ((h * 33) ^ canon.charCodeAt(i)) >>> 0;
  return `${m.type.replace(/^Mesh|Material$/g, '').toLowerCase()}_${h.toString(36)}`;
};

export class MaterialAgent extends Agent {
  constructor() {
    super({
      name: 'material',
      role: 'Resolves colours and PBR presets into deduplicated three.js materials.',
      subagents: [
        new SubAgent({
          name: 'color-resolver',
          description: 'Colour names / hex strings to 0xRRGGBB.',
          run: (c) => resolveColor(c),
          test: () => assert(resolveColor('red') === 0xd33b2f && resolveColor('#fff') === 0xffffff && resolveColor('0x00ff00') === 0x00ff00 && resolveColor('nope') === undefined),
        }),
        new SubAgent({
          name: 'preset-mapper',
          description: 'Maps preset + colour + model to a material type and PBR props.',
          run: (input) => resolveMaterial(input),
          test: () => {
            const g = resolveMaterial({ model: 'box', preset: 'glass' });
            assert(g.type === 'MeshPhysicalMaterial' && g.props.transmission === 1, 'glass');
            const n = resolveMaterial({ model: 'box', preset: 'neon', color: 0x00ff00 });
            assert(n.props.emissive === 0x00ff00, 'neon emissive');
            assert(resolveMaterial({ model: 'tree' }) === null, 'default passthrough');
          },
        }),
        new SubAgent({
          name: 'material-dedup',
          description: 'Gives identical materials the same cache key so they are shared, not duplicated.',
          run: (m) => (m ? { ...m, key: stableKey(m) } : null),
          test: () => {
            const a = stableKey({ type: 'MeshStandardMaterial', props: { color: 1, roughness: 0.5 } });
            const b = stableKey({ type: 'MeshStandardMaterial', props: { roughness: 0.5, color: 1 } });
            assert(a === b && /^[a-z]+_[a-z0-9]+$/.test(a), 'dedup key');
          },
        }),
      ],
    });
  }

  async handle(spec, ctx) {
    const byId = {};
    for (const o of spec.objects) {
      const m = await this.delegate('preset-mapper', { model: o.model, ...o.material }, ctx);
      byId[o.id] = await this.delegate('material-dedup', m, ctx);
    }
    let ground = null;
    const g = spec.environment.ground;
    if (g && g !== 'none') {
      const name = GROUND[g] || 'grass';
      const p = MATERIAL_PRESETS[name];
      const props = { ...p.props, roughness: Math.max(0.6, p.props.roughness ?? 0.9), metalness: name === 'metal' ? 0.6 : 0 };
      if (GROUND_COLORS[name]) props.color = GROUND_COLORS[name];
      ground = await this.delegate('material-dedup', { type: 'MeshStandardMaterial', props }, ctx);
    }
    return { byId, ground };
  }
}
