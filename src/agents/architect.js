// Architect agent: models ANY object from a blueprint (parts made of blended
// shapes with boolean cuts, mirrors and arrays). Built-in blueprints replace
// weak catalog props; custom blueprints let the calling model design anything.
import { Agent, SubAgent, assert } from '../core/agent.js';
import { MODELS } from '../library/models.js';
import { expandBlueprint, BLUEPRINT_LIBRARY, SHAPE_TYPES, BLUEPRINT_MATERIALS } from '../library/blueprint.js';

const OPS = ['add', 'union', 'subtract', 'cut', 'intersect'];

/** Structural validation with messages a model can act on. Never throws for fixable issues. */
function validate(dsl) {
  const errors = [], warnings = [];
  if (!dsl || typeof dsl !== 'object') return { errors: ['blueprint must be an object'], warnings };
  if (!Array.isArray(dsl.parts) || !dsl.parts.length) errors.push('blueprint.parts must be a non-empty array');
  (dsl.parts || []).forEach((p, i) => {
    const where = `parts[${i}]${p?.name ? ` "${p.name}"` : ''}`;
    if (!p || typeof p !== 'object') { errors.push(`${where} must be an object`); return; }
    if (!Array.isArray(p.shapes) || !p.shapes.length) { errors.push(`${where}.shapes must be a non-empty array`); return; }
    if (p.material && !BLUEPRINT_MATERIALS.includes(p.material)) warnings.push(`${where}: unknown material "${p.material}"`);
    p.shapes.forEach((s, j) => {
      const w = `${where}.shapes[${j}]`;
      if (!SHAPE_TYPES.includes(s?.type)) { errors.push(`${w}.type must be one of ${SHAPE_TYPES.join('|')}`); return; }
      if (s.op && !OPS.includes(s.op)) errors.push(`${w}.op must be add|subtract|intersect`);
      const vec = (k) => Array.isArray(s[k]) && s[k].length === 3 && s[k].every(Number.isFinite);
      if (['capsule', 'cylinder', 'cone'].includes(s.type)) { if (!vec('from') || !vec('to')) errors.push(`${w} needs from:[x,y,z] and to:[x,y,z]`); if (s.r === undefined) errors.push(`${w} needs r`); }
      else if (s.type === 'plane') { if (!vec('normal')) errors.push(`${w} needs normal:[x,y,z]`); }
      else if (!vec('at')) errors.push(`${w} needs at:[x,y,z]`);
      if (s.type === 'box' && !vec('size')) errors.push(`${w} needs size:[x,y,z]`);
      if (s.type === 'ellipsoid' && !vec('r')) errors.push(`${w} needs r:[x,y,z]`);
      if (s.type === 'sphere' && !(s.r > 0)) errors.push(`${w} needs r > 0`);
    });
  });
  const names = new Set();
  for (const b of dsl.bones || []) { if (!b.name || names.has(b.name)) errors.push(`bones need unique names (${b.name})`); names.add(b.name); if (b.parent && !names.has(b.parent)) errors.push(`bone "${b.name}" parent "${b.parent}" must be declared before it`); }
  return { errors, warnings };
}

/** Craft review of a compiled blueprint: is this a professional model or a weak one? */
function review({ dsl, bp, stats, issues }) {
  const notes = [...issues];
  const flat = (nodes) => nodes.flatMap((n) => (n.g ? flat(n.g) : [n]));
  const leaves = bp.parts.flatMap((p) => flat(p.nodes));
  const adds = leaves.filter((n) => !n.op || n.op === 'u').length, cuts = leaves.length - adds;
  const blended = dsl.parts.some((p) => p.shapes.some((q) => q.blend > 0));
  const mats = new Set(dsl.parts.map((p) => p.material || 'plastic'));
  if (adds < 6) notes.push(`only ${adds} solid shapes: the model will look primitive. Break forms into more shapes (bevels, panels, trims, fasteners).`);
  if (cuts === 0 && adds < 20) notes.push('no cuts: use op:"subtract" for openings, seams, recesses and wheel arches to add realism.');
  if (!blended && adds > 3) notes.push('no blends: add blend (0.01–0.1 × size) where forms should flow into each other.');
  if (mats.size < 2 && dsl.parts.length > 1) notes.push('one material for everything: give parts distinct materials (metal trim, rubber, glass, emissive lights).');
  if (dsl.parts.length === 1 && adds > 8) notes.push('single part: split by material so each surface gets its own PBR response.');
  const [sx, sy, sz] = stats.size;
  if (Math.min(sx, sy, sz) / Math.max(sx, sy, sz) < 0.01) notes.push('extremely thin overall proportions; check units (metres).');
  const craft = Math.max(0, Math.min(100, 40 + Math.min(30, adds * 1.5) + Math.min(10, cuts * 2) + (blended ? 8 : 0) + Math.min(12, (mats.size - 1) * 4) - issues.length * 6));
  return { craft: Math.round(craft), notes, shapes: { solid: adds, cuts }, materials: mats.size };
}

export class ArchitectAgent extends Agent {
  constructor() {
    super({
      name: 'architect',
      role: 'Designs any object as a blueprint of blended, cut, mirrored and arrayed shapes, then compiles it for the sculptor.',
      subagents: [
        new SubAgent({
          name: 'blueprint-library',
          description: `Built-in professional blueprints: ${Object.keys(BLUEPRINT_LIBRARY).join(', ')} (parametric).`,
          run: ({ name, params }) => { assert(BLUEPRINT_LIBRARY[name], `no library blueprint "${name}"`); return BLUEPRINT_LIBRARY[name](params || {}); },
          test: () => { for (const n of Object.keys(BLUEPRINT_LIBRARY)) { const d = BLUEPRINT_LIBRARY[n]({}); assert(validate(d).errors.length === 0, `${n}: ${validate(d).errors.join('; ')}`); } },
        }),
        new SubAgent({
          name: 'schema-validator',
          description: 'Checks a blueprint and explains exactly what to fix.',
          run: (dsl) => validate(dsl),
          test: () => {
            assert(validate({ parts: [{ shapes: [{ type: 'sphere', at: [0, 0, 0], r: 1 }] }] }).errors.length === 0);
            const bad = validate({ parts: [{ name: 'x', shapes: [{ type: 'blob' }, { type: 'box', at: [0, 0, 0] }] }] });
            assert(bad.errors.length === 2 && bad.errors[1].includes('size'), bad.errors.join('|'));
          },
        }),
        new SubAgent({
          name: 'blueprint-compiler',
          description: 'Expands mirrors/arrays, scales and grounds the model, picks per-part resolution, binds PBR materials and paint.',
          run: (dsl) => expandBlueprint(dsl),
          test: () => {
            const { bp, stats } = expandBlueprint({ height: 2, parts: [{ name: 'a', material: 'metal', color: 'red', shapes: [{ type: 'box', at: [0, 5, 0], size: [1, 1, 1] }, { type: 'sphere', at: [0.4, 5, 0], r: 0.1, op: 'subtract', mirror: 'x', array: { count: 4, radial: 'y', center: [0, 5, 0] } }] }] });
            assert(Math.abs(stats.size[1] - 2) < 1e-6, 'scaled to height');
            assert(bp.parts[0].nodes.length === 1 + 8, `mirror × array expanded (${bp.parts[0].nodes.length})`);
            const y = bp.parts[0].nodes[0].s[2];
            assert(Math.abs(y - 1) < 1e-6, 'grounded: box centre at half its height');
          },
        }),
        new SubAgent({
          name: 'design-reviewer',
          description: 'Critiques the design: too few forms, no cuts/blends, single material, floating or unresolvable parts.',
          run: (input) => review(input),
          test: () => {
            const dsl = { parts: [{ name: 'a', shapes: [{ type: 'sphere', at: [0, 0, 0], r: 1 }] }] };
            const c = expandBlueprint(dsl);
            const weak = review({ dsl, ...c });
            const car = BLUEPRINT_LIBRARY.car({}), strong = review({ dsl: car, ...expandBlueprint(car) });
            assert(weak.craft < 60 && weak.notes.length > 0 && strong.craft > 85, `weak ${weak.craft} strong ${strong.craft}`);
          },
        }),
      ],
    });
  }

  /** Compile a blueprint (custom or library). Throws a helpful error on structural problems. */
  async design(dsl, ctx) {
    const v = await this.delegate('schema-validator', dsl, ctx);
    if (v.errors.length) throw new Error(`Invalid blueprint: ${v.errors.slice(0, 6).join('; ')}${v.errors.length > 6 ? ` (+${v.errors.length - 6} more)` : ''}`);
    const compiled = await this.delegate('blueprint-compiler', dsl, ctx);
    const rev = await this.delegate('design-reviewer', { dsl, ...compiled }, ctx);
    return { ...compiled, review: rev, warnings: v.warnings };
  }

  /** Scene pipeline: compile every blueprint-backed object in place. */
  async handle(spec, ctx) {
    for (const o of spec.objects) {
      const lib = MODELS[o.model].library;
      if (o.model !== 'blueprint' && !(lib && spec.style !== 'stylized')) continue;
      if (o.params.bp) continue; // already compiled (round trip)
      let dsl = o.blueprint;
      if (!dsl && lib) dsl = await this.delegate('blueprint-library', { name: lib, params: { ...o.params, ...(o.material?.color !== undefined ? { color: o.material.color } : {}), ...(o.count > 12 ? { detail: 'low' } : {}) } }, ctx);
      if (!dsl) { ctx.warn(`${o.id}: model "blueprint" needs a blueprint object`); continue; }
      const d = await this.design(dsl, ctx);
      o.params = { ...o.params, bp: d.bp };
      if (lib) o.material = {}; // colour is baked into the blueprint's paint
      if (!lib) for (const n of d.review.notes.slice(0, 3)) ctx.warn(`${o.id}: ${n}`);
      if (d.bp.motions && !o.animation && o.count <= 3) o.animation = { type: 'idle', speed: 1 };
      o.sheet = `${d.bp.name}: ${d.stats.parts} parts, ${d.stats.shapes} shapes, ${d.stats.size.map((q) => q.toFixed(2)).join('×')} m, craft ${d.review.craft}/100`;
    }
    return spec;
  }
}
