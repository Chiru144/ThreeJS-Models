// Blueprints: a compact modelling language for arbitrary objects.
//   expandBlueprint(dsl)  (Node, used by the Architect agent) -> compiled plan
//   makeBlueprint(THREE, M, p)  (copied into generated scenes) -> sculpts the plan
// plus a library of built-in professional blueprints (car, house, ...).
/* eslint-disable no-undef */
import * as THREE_NODE from 'three';
import { MATERIAL_PRESETS, resolveColor } from './materials.js';

// ---------------- runtime factory (emitted into scenes) ----------------
function makeBlueprint(THREE, M, p, main) {
  const bp = p.bp, lod = p.lod === 'low' ? 2 : 1;
  const cache = (sculpt.cache ||= new Map());
  const h3 = (x, y, z) => { const q = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return q - Math.floor(q); };
  const vn = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy), q = fz * fz * (3 - 2 * fz);
    let r = 0;
    for (let c = 0; c < 8; c++) { const dx = c & 1, dy = (c >> 1) & 1, dz = c >> 2; r += h3(ix + dx, iy + dy, iz + dz) * (dx ? u : 1 - u) * (dy ? w : 1 - w) * (dz ? q : 1 - q); }
    return r;
  };
  const paintOf = (pt) => (x, y, z, c, n) => {
    const [a, b] = [pt.c1, pt.c2 || pt.c1], f = pt.scale || 1;
    let t = 0;
    if (pt.pattern === 'noise') t = vn(x * f, y * f, z * f);
    else if (pt.pattern === 'gradient') t = Math.min(1, Math.max(0, (y - pt.y0) / Math.max(1e-6, pt.y1 - pt.y0)));
    else if (pt.pattern === 'stripes') t = Math.sin((pt.axis === 'x' ? x : pt.axis === 'z' ? z : y) * f * Math.PI * 2) > 0 ? 1 : 0;
    else if (pt.pattern === 'spots') t = h3(Math.floor(x * f), Math.floor(y * f), Math.floor(z * f)) > 0.6 && Math.hypot((x * f) % 1 - 0.5, (y * f) % 1 - 0.5, (z * f) % 1 - 0.5) < 0.42 ? 1 : 0;
    else if (pt.pattern === 'checker') t = (Math.floor(x * f) + Math.floor(y * f) + Math.floor(z * f)) % 2 ? 1 : 0;
    else if (pt.pattern === 'wear') t = Math.max(0, 1 - c[0]) * 2 + vn(x * f, y * f, z * f) * 0.4; // lighter on exposed edges (uses AO-free tint)
    const g = 0.94 + 0.12 * vn(x * 37 + 1.7, y * 37, z * 37); // subtle material grain so nothing is perfectly flat
    c[0] *= (a[0] + (b[0] - a[0]) * t) * g; c[1] *= (a[1] + (b[1] - a[1]) * t) * g; c[2] *= (a[2] + (b[2] - a[2]) * t) * g;
  };
  let K = null, root;
  if (bp.bones && bp.bones.length) { K = rigKit(M, bp.bones.map((b) => [b.name, b.parent ?? null, b.at]), lod); root = K.root; } else root = new THREE.Group();
  for (const part of bp.parts) {
    const mat = M(part.mat.key, part.mat.props, part.mat.type);
    if (part.micro) detailize(mat, part.micro[0], part.micro[1], part.micro[2]);
    const key = JSON.stringify([part.nodes, part.cell, lod, part.paint]);
    let geo = cache.get(key);
    if (!geo) { geo = sculpt(part.nodes, { cell: part.cell * lod, ao: part.ao ?? 1, paint: paintOf(part.paint), simplify: part.simplify ?? 4, colorTol: 0.08, boneParents: K ? K.boneParents : undefined }); cache.set(key, geo); }
    let mesh;
    if (K) { mesh = new THREE.SkinnedMesh(geo, mat); mesh.frustumCulled = false; root.add(mesh); mesh.bind(K.skeleton, new THREE.Matrix4()); } else { mesh = new THREE.Mesh(geo, mat); root.add(mesh); }
    mesh.name = part.name;
    if (part.noShadow) mesh.userData.noShadow = true;
  }
  for (const l of bp.lights || []) { const pl = new THREE.PointLight(l.color, l.intensity, l.distance, 2); pl.position.set(l.at[0], l.at[1], l.at[2]); root.add(pl); }
  if (K && bp.motions && bp.motions.length) {
    const ms = bp.motions.map((m) => ({ ...m, b: K.bones[K.B[m.bone]] })).filter((m) => m.b);
    root.userData.rig = (t, mode) => {
      for (const b of K.bones) b.rotation.set(0, 0, 0);
      for (const m of ms) if (!m.mode || m.mode === mode || m.mode === 'always') m.b.rotation[m.axis] = (m.offset || 0) + (m.spin ? t * m.speed : Math.sin(t * m.speed + (m.phase || 0)) * m.amp);
    };
    root.userData.rig(0, 'idle');
    // loop length per mode = one cycle of its slowest motion
    const modes = {}; for (const m of ms) { const k = m.mode || 'idle'; modes[k] = Math.max(modes[k] || 0, (Math.PI * 2) / Math.max(0.2, m.speed)); }
    root.userData.clips = Object.entries(modes).filter(([k]) => k !== 'always');
  }
  return root;
}
export const BLUEPRINT_FACTORY = makeBlueprint;

// ---------------- compiler: DSL -> sculpt plan (runs in Node) ----------------
const DEG = Math.PI / 180;
const AXES = { x: 0, y: 1, z: 2 };
const DETAIL = { low: 70, medium: 115, high: 170, ultra: 230 };
const EXTRA_MATERIALS = {
  'tinted-glass': { type: 'MeshPhysicalMaterial', props: { roughness: 0.04, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.03 } },
  emissive: { type: 'MeshStandardMaterial', props: { roughness: 0.4 }, emissive: true },
  leather: { type: 'MeshPhysicalMaterial', props: { roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4 } },
  fabric: { type: 'MeshPhysicalMaterial', props: { roughness: 0.9, sheen: 0.6, sheenRoughness: 0.8 } },
  brick: { type: 'MeshStandardMaterial', props: { roughness: 0.95 } },
  plaster: { type: 'MeshStandardMaterial', props: { roughness: 0.92 } },
  'roof-tile': { type: 'MeshStandardMaterial', props: { roughness: 0.8 } },
  skin: { type: 'MeshPhysicalMaterial', props: { roughness: 0.52, sheen: 0.35, sheenRoughness: 0.45, sheenColor: 0xffb8a0 } },
};
export const BLUEPRINT_MATERIALS = [...Object.keys(MATERIAL_PRESETS), ...Object.keys(EXTRA_MATERIALS)];
export const SHAPE_TYPES = ['sphere', 'ellipsoid', 'box', 'capsule', 'cylinder', 'cone', 'torus', 'plane'];
const OPS = { add: 'u', union: 'u', subtract: 's', cut: 's', intersect: 'i' };
const v3 = (a, d = [0, 0, 0]) => (Array.isArray(a) && a.length === 3 && a.every(Number.isFinite) ? a.slice() : d.slice());
const lin = (hex) => { const c = new THREE_NODE.Color(hex); return [+c.r.toFixed(4), +c.g.toFixed(4), +c.b.toFixed(4)]; };
const r4 = (n) => Math.round(n * 1e4) / 1e4;

function mirrorShape(s, axis) {
  const i = AXES[axis], o = { ...s };
  for (const k of ['at', 'from', 'to', 'normal']) if (s[k]) { o[k] = s[k].slice(); o[k][i] = -o[k][i]; }
  if (s.rotate) { o.rotate = s.rotate.slice(); for (let j = 0; j < 3; j++) if (j !== i) o.rotate[j] = -o.rotate[j]; }
  return o;
}
function rotateShape(s, axis, angle, center) {
  const q = new THREE_NODE.Quaternion().setFromAxisAngle(new THREE_NODE.Vector3(...[0, 0, 0].map((_, j) => (j === AXES[axis] ? 1 : 0))), angle);
  const o = { ...s }, c = new THREE_NODE.Vector3(...center);
  for (const k of ['at', 'from', 'to']) if (s[k]) o[k] = new THREE_NODE.Vector3(...s[k]).sub(c).applyQuaternion(q).add(c).toArray();
  if (s.normal) o.normal = new THREE_NODE.Vector3(...s.normal).applyQuaternion(q).toArray();
  const e = new THREE_NODE.Euler(...(s.rotate || [0, 0, 0]).map((d) => d * DEG));
  const qq = q.clone().multiply(new THREE_NODE.Quaternion().setFromEuler(e));
  const out = new THREE_NODE.Euler().setFromQuaternion(qq);
  o.rotate = [out.x / DEG, out.y / DEG, out.z / DEG];
  return o;
}
/** Rotate a shape (degrees, XYZ) about a pivot, then translate it: places whole parts at an angle. */
function transformShape(s, rotate, pivot = [0, 0, 0], move = [0, 0, 0]) {
  const q = new THREE_NODE.Quaternion().setFromEuler(new THREE_NODE.Euler(...(rotate || [0, 0, 0]).map((d) => d * DEG)));
  const c = new THREE_NODE.Vector3(...pivot), mv = new THREE_NODE.Vector3(...move), o = { ...s };
  for (const k of ['at', 'from', 'to']) if (s[k]) o[k] = new THREE_NODE.Vector3(...s[k]).sub(c).applyQuaternion(q).add(c).add(mv).toArray();
  if (s.normal) o.normal = new THREE_NODE.Vector3(...s.normal).applyQuaternion(q).toArray();
  if (rotate) { const e = new THREE_NODE.Euler().setFromQuaternion(q.clone().multiply(new THREE_NODE.Quaternion().setFromEuler(new THREE_NODE.Euler(...(s.rotate || [0, 0, 0]).map((d) => d * DEG))))); o.rotate = [e.x / DEG, e.y / DEG, e.z / DEG]; }
  return o;
}
function applyModifiers(s) {
  let list = [s];
  if (s.array && s.array.count > 1) {
    const { count, radial, step, center = [0, 0, 0] } = s.array, out = [];
    for (let k = 0; k < Math.min(count, 64); k++) for (const q of list) {
      if (radial) out.push(rotateShape(q, radial, (k / count) * Math.PI * 2, center));
      else { const o = { ...q }; for (const key of ['at', 'from', 'to']) if (q[key]) o[key] = q[key].map((c, j) => c + (step?.[j] || 0) * k); out.push(o); }
    }
    list = out;
  }
  if (s.mirror) for (const ax of String(s.mirror)) if (ax in AXES) list = list.flatMap((q) => [q, mirrorShape(q, ax)]);
  return list;
}

/** One DSL shape -> sculpt node (+ its bounding box for sizing). */
function compileShape(s, k, issues, bones) {
  const type = s.type, rot = s.rotate ? s.rotate.map((d) => r4(d * DEG)) : undefined;
  let node, box;
  const num = (x, d) => (Number.isFinite(x) && x > 0 ? x * k : d * k);
  const at = v3(s.at).map((c) => c * k);
  // world-axis half extents of a rotated local box
  const ext = (h) => { if (!s.rotate) return h; const m = new THREE_NODE.Matrix4().makeRotationFromEuler(new THREE_NODE.Euler(...s.rotate.map((d) => d * DEG))).elements; return [0, 1, 2].map((i) => Math.abs(m[i]) * h[0] + Math.abs(m[i + 4]) * h[1] + Math.abs(m[i + 8]) * h[2]); };
  if (type === 'sphere') { const r = num(s.r, 0.5); node = { s: ['s', ...at, r] }; box = [at.map((c) => c - r), at.map((c) => c + r)]; }
  else if (type === 'ellipsoid') { const r = v3(s.r, [0.5, 0.5, 0.5]).map((c) => Math.abs(c) * k || 0.01); node = { s: ['e', ...at, ...r], rot }; const e = ext(r); box = [at.map((c, i) => c - e[i]), at.map((c, i) => c + e[i])]; }
  else if (type === 'box') { const h = v3(s.size, [1, 1, 1]).map((c) => Math.abs(c) * k / 2); const rd = Math.min(Math.min(...h) * 0.98, (s.round ?? Math.min(...h) * 0.08) * (s.round !== undefined ? k : 1)); node = { s: ['b', ...at, ...h, rd], rot }; const e = ext(h); box = [at.map((c, i) => c - e[i]), at.map((c, i) => c + e[i])]; }
  else if (type === 'capsule' || type === 'cylinder' || type === 'cone') {
    const a = v3(s.from, [0, 0, 0]).map((c) => c * k), b = v3(s.to, [0, 1, 0]).map((c) => c * k);
    if (Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < 1e-6) { issues.push(`${type} has zero length`); return null; }
    const rr = Array.isArray(s.r) ? s.r : [s.r, type === 'cone' ? (s.r2 ?? 0.001) : s.r];
    const r1 = num(rr[0], 0.1), r2 = Math.max(1e-4, Number.isFinite(rr[1]) ? rr[1] * k : r1);
    node = type === 'capsule' ? { s: ['rc', ...a, ...b, r1, r2] } : { s: ['cc', ...a, ...b, r1, r2], ...(s.round ? { round: s.round * k } : {}) };
    // tight bounds: a flat-capped cylinder only extends by its radius perpendicular to its axis
    const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), rm = Math.max(r1, r2), rd = (s.round || 0) * k;
    const e = [0, 1, 2].map((i) => (type === 'capsule' ? rm : rm * Math.sqrt(Math.max(0, 1 - ((b[i] - a[i]) / len) ** 2)) + rd));
    box = [a.map((c, i) => Math.min(c, b[i]) - e[i]), a.map((c, i) => Math.max(c, b[i]) + e[i])];
  } else if (type === 'torus') {
    const R = num(s.R ?? s.r, 0.5), r = num(s.tube ?? s.r2, 0.1), ax = s.axis || 'y';
    const base = ax === 'x' ? [0, 0, 90] : ax === 'z' ? [90, 0, 0] : [0, 0, 0];
    const e = new THREE_NODE.Euler().setFromQuaternion(new THREE_NODE.Quaternion().setFromEuler(new THREE_NODE.Euler(...(s.rotate || [0, 0, 0]).map((d) => d * DEG))).multiply(new THREE_NODE.Quaternion().setFromEuler(new THREE_NODE.Euler(...base.map((d) => d * DEG)))));
    node = { s: ['t', ...at, R, r], rot: [r4(e.x), r4(e.y), r4(e.z)] }; const m = R + r; box = [at.map((c) => c - m), at.map((c) => c + m)];
  } else if (type === 'plane') {
    const n = v3(s.normal, [0, 1, 0]), l = Math.hypot(...n) || 1, nn = n.map((c) => c / l);
    node = { s: ['p', ...nn.map(r4), r4(nn[0] * at[0] + nn[1] * at[1] + nn[2] * at[2])] }; box = null;
  } else { issues.push(`unknown shape type "${type}" (use ${SHAPE_TYPES.join(', ')})`); return null; }
  node.s = node.s.map((q) => (typeof q === 'number' ? r4(q) : q));
  const op = OPS[s.op] || (type === 'plane' ? 'i' : 'u');
  if (op !== 'u') node.op = op;
  if (s.blend) node.k = r4(s.blend * k);
  if (s.scale) node.sc = [...at.map(r4), ...v3(s.scale, [1, 1, 1])];
  if (s.noise) node.n = [r4((s.noise.amp ?? 0.01) * k), r4((s.noise.freq ?? 20) / k), s.noise.kind || 'n'];
  if (s.bone !== undefined && bones) { const bi = bones.indexOf(s.bone); if (bi >= 0) node.bone = bi; else issues.push(`shape references unknown bone "${s.bone}"`); }
  if (!node.rot || node.rot.every((q) => q === 0)) delete node.rot;
  return { node, box: op === 'u' ? box : null, minR: type === 'box' ? Math.min(...node.s.slice(4, 7)) : type === 'sphere' ? node.s[4] : type === 'ellipsoid' ? Math.min(...node.s.slice(4, 7)) : type === 'torus' ? node.s[5] : type === 'plane' ? Infinity : Math.max(node.s[7], node.s[8]) };
}

/**
 * Compile a blueprint. Returns { bp, issues[], stats } — bp is what makeBlueprint consumes.
 * DSL: { name, height?, detail?, ground?, parts: [{ name, material, color, color2?, pattern?, patternScale?,
 *   emissive?, mirror?, noise?, detail?, bone?, shapes: [{ type, at|from/to, r|size, rotate?, op?, blend?, scale?,
 *   round?, mirror?, array?, noise?, bone? }] }], bones?: [{ name, parent?, at }], motions?: [...], lights?: [...] }
 */
export function expandBlueprint(dsl) {
  const issues = [];
  if (!dsl || !Array.isArray(dsl.parts) || !dsl.parts.length) throw new Error('blueprint needs parts: [{ name, material, color, shapes: [...] }]');
  // pass 1: raw bounds (unscaled) to derive scale, grounding and resolution
  const all = [];
  let lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
  const pre = dsl.parts.map((part, pi) => {
    if (!Array.isArray(part.shapes) || !part.shapes.length) { issues.push(`part "${part.name || pi}" has no shapes`); return null; }
    let shapes = part.shapes.flatMap((s) => applyModifiers(s));
    if (part.rotate || part.move) shapes = shapes.map((s) => transformShape(s, part.rotate, part.pivot, part.move));
    shapes = shapes.flatMap((s) => (part.mirror ? [...String(part.mirror)].reduce((l, ax) => (ax in AXES ? l.flatMap((q) => [q, mirrorShape(q, ax)]) : l), [s]) : [s]));
    return { part, shapes };
  }).filter(Boolean);
  const boneNames = (dsl.bones || []).map((b) => b.name);
  const clampByPlanes = (shapes, plo, phi) => {
    for (const s of shapes) {
      if (s.type !== 'plane' || (s.op && s.op !== 'intersect')) continue;
      const n = v3(s.normal, [0, 1, 0]), l = Math.hypot(...n), at = v3(s.at);
      for (let i = 0; i < 3; i++) { const c = n[i] / l; if (c > 0.999) phi[i] = Math.min(phi[i], at[i]); else if (c < -0.999) plo[i] = Math.max(plo[i], at[i]); }
    }
  };
  for (const pp of pre) {
    const plo = [Infinity, Infinity, Infinity], phi = [-Infinity, -Infinity, -Infinity];
    for (const s of pp.shapes) { const c = compileShape(s, 1, [], boneNames); if (c?.box) for (let i = 0; i < 3; i++) { plo[i] = Math.min(plo[i], c.box[0][i]); phi[i] = Math.max(phi[i], c.box[1][i]); } }
    clampByPlanes(pp.shapes, plo, phi);
    for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], plo[i]); hi[i] = Math.max(hi[i], phi[i]); }
  }
  if (!Number.isFinite(lo[0])) throw new Error('blueprint has no solid shapes');
  const cutGround = dsl.ground === 'cut'; // slice everything below y = 0 (author coordinates) flat
  if (cutGround) lo[1] = Math.max(lo[1], 0);
  const k = dsl.height > 0 ? dsl.height / Math.max(1e-6, hi[1] - lo[1]) : 1;
  const shift = [dsl.center === false ? 0 : -(lo[0] + hi[0]) / 2, dsl.ground === false ? 0 : -lo[1], dsl.center === false ? 0 : -(lo[2] + hi[2]) / 2];
  const size = [0, 1, 2].map((i) => (hi[i] - lo[i]) * k), maxDim = Math.max(...size);
  const baseCell = maxDim / (DETAIL[dsl.detail] || DETAIL.medium);
  const move = (s) => { const o = { ...s }; for (const key of ['at', 'from', 'to']) if (s[key]) o[key] = s[key].map((c, i) => c + shift[i]); if (s.array?.center) o.array = { ...s.array, center: s.array.center.map((c, i) => c + shift[i]) }; return o; };
  const parts = [];
  let shapeCount = 0;
  for (const { part, shapes } of pre) {
    const nodes = [], boxes = []; let minR = Infinity;
    for (const s of shapes) {
      const c = compileShape(move(s), k, issues, boneNames);
      if (!c) continue;
      if (part.bone !== undefined && c.node.bone === undefined && boneNames.includes(part.bone)) c.node.bone = boneNames.indexOf(part.bone);
      nodes.push(c.node); if (c.box) boxes.push(c.box); if ((c.node.op ?? 'u') === 'u') minR = Math.min(minR, c.minR);
    }
    if (!nodes.some((n) => (n.op ?? 'u') === 'u')) { issues.push(`part "${part.name}" has no solid (add) shape`); continue; }
    if (cutGround) nodes.push({ s: ['p', 0, -1, 0, 0], op: 'i' });
    shapeCount += nodes.length;
    const plo = [0, 1, 2].map((i) => Math.min(...boxes.map((b) => b[0][i]))), phi = [0, 1, 2].map((i) => Math.max(...boxes.map((b) => b[1][i])));
    clampByPlanes(shapes.map((q) => { const m = move(q); return { ...m, at: m.at ? m.at.map((c) => c * k) : m.at }; }), plo, phi);
    if (cutGround) plo[1] = Math.max(plo[1], 0);
    // resolution: fine enough for the thinnest feature, bounded so a part stays affordable
    const pd = Math.max(...[0, 1, 2].map((i) => phi[i] - plo[i]));
    let cell = part.detail && DETAIL[part.detail] ? pd / DETAIL[part.detail] : Math.min(baseCell, pd / 26);
    if (Number.isFinite(minR) && minR < cell * 1.25) { const want = minR / 1.25, floor = pd / 260; if (want < floor) issues.push(`part "${part.name}": a feature of ${(minR * 2 * 100).toFixed(1)} cm is too thin to resolve; thicken it or split it into its own part`); cell = Math.max(want, floor); }
    const group = part.noise ? [{ g: nodes, n: [r4((part.noise.amp ?? 0.01) * k), r4((part.noise.freq ?? 20) / k), part.noise.kind || 'n'] }] : nodes;
    const name = part.material && (MATERIAL_PRESETS[part.material] || EXTRA_MATERIALS[part.material]) ? part.material : 'plastic';
    if (part.material && name !== part.material) issues.push(`part "${part.name}": unknown material "${part.material}" → plastic (see forge_catalog section=blueprint)`);
    const preset = MATERIAL_PRESETS[name] || EXTRA_MATERIALS[name];
    const colorHex = resolveColor(part.color) ?? preset.props.color ?? 0x9aa0a8;
    if (part.color !== undefined && resolveColor(part.color) === undefined) issues.push(`part "${part.name}": unknown colour "${part.color}"`);
    const props = { ...preset.props, color: 0xffffff, vertexColors: true };
    if (preset.emissive || part.emissive) { props.emissive = colorHex; props.emissiveIntensity = part.emissive ?? preset.props.emissiveIntensity ?? 2; }
    if (props.transmission) props.transparent = false;
    const mkey = `bp_${name}_${Object.entries(props).map(([a, b]) => `${a}${b}`).join('').replace(/[^a-z0-9]/gi, '').slice(0, 60)}`;
    const paint = { c1: lin(colorHex), pattern: part.pattern || 'solid' };
    if (part.color2 !== undefined) paint.c2 = lin(resolveColor(part.color2) ?? colorHex);
    if (part.patternScale) paint.scale = part.patternScale / k;
    if (paint.pattern === 'gradient') { paint.y0 = r4(plo[1]); paint.y1 = r4(phi[1]); }
    if (part.patternAxis) paint.axis = part.patternAxis;
    const MICRO = { wood: ['bark', 40, 0.5], stone: ['grain', 45, 1.1], brick: ['grain', 60, 1.2], plaster: ['grain', 90, 0.6], 'roof-tile': ['grain', 70, 0.9], fabric: ['weave', 900, 0.8], leather: ['leather', 260, 0.7], rubber: ['grain', 300, 0.5], skin: ['pores', 1500, 0.5], matte: ['grain', 120, 0.4] }[name]; // metals, glass and paint stay clean
    const micro = part.micro === false ? null : MICRO ? [MICRO[0], +(MICRO[1] / (k > 0 ? 1 : 1)).toFixed(2), MICRO[2]] : null;
    parts.push({ name: String(part.name || `part${parts.length + 1}`), nodes: group, cell: +cell.toPrecision(3), mat: { key: mkey, type: preset.type, props }, paint, ...(micro ? { micro } : {}), ...(name === 'glass' || part.noShadow ? { noShadow: true } : {}), box: [plo.map(r4), phi.map(r4)] });
    all.push([plo, phi]);
  }
  if (!parts.length) throw new Error(`blueprint produced no parts: ${issues.join('; ')}`);
  if (shapeCount > 600) issues.push(`${shapeCount} shapes is heavy; aim for < 300`);
  // design review: parts that touch nothing float in the air
  parts.forEach((p, i) => {
    if (parts.length < 2) return;
    const touches = parts.some((q, j) => j !== i && [0, 1, 2].every((a) => p.box[0][a] <= q.box[1][a] + p.cell * 2 && p.box[1][a] >= q.box[0][a] - p.cell * 2));
    if (!touches) issues.push(`part "${p.name}" does not touch any other part (floating)`);
  });
  const bones = (dsl.bones || []).map((b) => ({ name: b.name, parent: b.parent ?? null, at: v3(b.at).map((c, i) => r4((c + shift[i]) * k)) }));
  const bp = { name: String(dsl.name || 'model').slice(0, 60), parts: parts.map(({ box, ...p }) => p) };
  if (bones.length) bp.bones = bones;
  if (dsl.motions?.length && bones.length) bp.motions = dsl.motions.filter((m) => boneNames.includes(m.bone) && ['x', 'y', 'z'].includes(m.axis)).map((m) => ({ bone: m.bone, axis: m.axis, amp: (m.amp ?? 20) * DEG, speed: m.speed ?? 2, phase: m.phase || 0, ...(m.spin ? { spin: true } : {}), ...(m.mode ? { mode: m.mode } : {}), ...(m.offset ? { offset: m.offset * DEG } : {}) }));
  if (dsl.lights?.length) bp.lights = dsl.lights.slice(0, 4).map((l) => ({ color: resolveColor(l.color) ?? 0xffe0b0, intensity: l.intensity ?? 5, distance: (l.distance ?? 8) * k, at: v3(l.at).map((c, i) => r4((c + shift[i]) * k)) }));
  bp.size = { footprint: r4(Math.max(size[0], size[2]) / 2), height: r4(size[1]) };
  return { bp, issues, stats: { parts: parts.length, shapes: shapeCount, size: size.map(r4), cell: +baseCell.toPrecision(3) } };
}

// ---------------- library: built-in professional blueprints ----------------
const hexOf = (c, d) => resolveColor(c) ?? d;

export const BLUEPRINT_LIBRARY = {
  car: ({ length = 4.4, color = 0xc0392b, detail = 'medium' }) => {
    const s = length / 4.4, L = length, W = 1.8 * s, wr = 0.34 * s, wz = W / 2 - 0.14 * s;
    const wheels = [[L * 0.3, wz], [L * 0.3, -wz], [-L * 0.29, wz], [-L * 0.29, -wz]];
    const cab = { at: [-0.25 * s, 0.72 * s, 0], r: [L * 0.3, 0.62 * s, W * 0.47] };
    return {
      name: 'car', detail,
      parts: [
        { name: 'body', material: 'carpaint', color, shapes: [
          { type: 'box', at: [0, 0.54 * s, 0], size: [L, 0.46 * s, W], round: 0.15 * s },
          { type: 'ellipsoid', ...cab, blend: 0.1 * s },
          { type: 'ellipsoid', at: [L * 0.36, 0.5 * s, 0], r: [L * 0.16, 0.24 * s, W * 0.5], blend: 0.08 * s },
          { type: 'plane', normal: [0, -1, 0], at: [0, 0.3 * s, 0], blend: 0.03 * s },
          ...wheels.map(([x, z]) => ({ type: 'cylinder', from: [x, wr, z - 0.2 * s * Math.sign(z)], to: [x, wr, z + 0.3 * s * Math.sign(z)], r: wr + 0.07 * s, op: 'subtract', blend: 0.03 * s })),
          { type: 'ellipsoid', at: [0.55 * s, 0.98 * s, W / 2 + 0.05 * s], r: [0.08 * s, 0.055 * s, 0.1 * s], mirror: 'z', blend: 0.03 * s },
        ] },
        { name: 'windows', material: 'tinted-glass', color: 0x1a2530, shapes: [
          { type: 'ellipsoid', at: cab.at, r: cab.r.map((q) => q + 0.012 * s) },
          { type: 'plane', normal: [0, -1, 0], at: [0, 0.92 * s, 0] },
          { type: 'plane', normal: [0, 1, 0], at: [0, 1.22 * s, 0] },
          { type: 'box', at: [-0.32 * s, 1.05 * s, 0], size: [0.1 * s, 0.5 * s, W * 1.2], op: 'subtract' },
          { type: 'capsule', from: [0.55 * s, 0.9 * s, W * 0.44], to: [0.25 * s, 1.26 * s, W * 0.36], r: 0.05 * s, op: 'subtract', mirror: 'z' },
          { type: 'capsule', from: [-1.15 * s, 0.9 * s, W * 0.44], to: [-0.85 * s, 1.26 * s, W * 0.36], r: 0.055 * s, op: 'subtract', mirror: 'z' },
        ] },
        { name: 'trim', material: 'rubber', color: 0x1c1d20, shapes: [
          { type: 'box', at: [0, 0.3 * s, 0], size: [L * 0.93, 0.16 * s, W * 0.88], round: 0.05 * s },
          { type: 'box', at: [L / 2 - 0.06 * s, 0.36 * s, 0], size: [0.2 * s, 0.15 * s, W * 0.94], round: 0.06 * s },
          { type: 'box', at: [-L / 2 + 0.06 * s, 0.38 * s, 0], size: [0.2 * s, 0.15 * s, W * 0.94], round: 0.06 * s },
          { type: 'box', at: [L / 2 - 0.02 * s, 0.52 * s, 0], size: [0.08 * s, 0.13 * s, W * 0.45], round: 0.03 * s },
        ] },
        { name: 'tyres', material: 'rubber', color: 0x161616, shapes: wheels.flatMap(([x, z]) => [
          { type: 'cylinder', from: [x, wr, z - 0.1 * s], to: [x, wr, z + 0.1 * s], r: wr - 0.03 * s, round: 0.03 * s },
          { type: 'cylinder', from: [x, wr, z - 0.2 * s], to: [x, wr, z + 0.2 * s], r: 0.215 * s, op: 'subtract' },
        ]) },
        { name: 'rims', material: 'chrome', color: 0xd8dade, detail: 'medium', shapes: wheels.flatMap(([x, z]) => [
          { type: 'cylinder', from: [x, wr, z - 0.07 * s], to: [x, wr, z + 0.07 * s], r: 0.205 * s, round: 0.012 * s },
          { type: 'cylinder', from: [x + 0.125 * s, wr, z - 0.2 * s], to: [x + 0.125 * s, wr, z + 0.2 * s], r: 0.045 * s, op: 'subtract', array: { count: 5, radial: 'z', center: [x, wr, z] } },
          { type: 'sphere', at: [x, wr, z + 0.07 * s * Math.sign(z)], r: 0.05 * s, blend: 0.01 * s },
        ]) },
        { name: 'headlights', material: 'emissive', color: 0xfff4d6, emissive: 2.5, shapes: [{ type: 'ellipsoid', at: [L / 2 - 0.1 * s, 0.63 * s, W * 0.33], r: [0.09 * s, 0.065 * s, 0.17 * s], mirror: 'z' }] },
        { name: 'taillights', material: 'emissive', color: 0xd01818, emissive: 1.8, shapes: [{ type: 'ellipsoid', at: [-L / 2 + 0.07 * s, 0.68 * s, W * 0.34], r: [0.07 * s, 0.055 * s, 0.16 * s], mirror: 'z' }] },
      ],
    };
  },

  house: ({ width = 5, depth = 4.5, height = 2.7, lit = false, color = 0xe8dcc8, detail = 'medium' }) => {
    const w = width, d = depth, h = height, f = 0.24, rh = d * 0.38, a = Math.atan2(rh, d / 2) / DEG;
    const wy = f + h * 0.56, win = (x, z, alongX) => ({ at: [x, wy, z], size: alongX ? [0.95, 1.05, 0.34] : [0.34, 1.05, 0.95] });
    const windows = [win(-w * 0.3, d / 2, true), win(w * 0.3, d / 2, true), win(w / 2, 0, false), win(-w / 2, 0, false), win(0, -d / 2, true)];
    const slope = Math.hypot(d / 2 + 0.4, rh * (1 + 0.8 / d));
    return {
      name: 'house', detail,
      parts: [
        { name: 'foundation', material: 'stone', color: 0x77736d, pattern: 'noise', color2: 0x5f5b56, patternScale: 6, shapes: [
          { type: 'box', at: [0, f / 2, 0], size: [w + 0.3, f, d + 0.3], round: 0.03 },
          { type: 'box', at: [0, f * 0.3, d / 2 + 0.45], size: [1.5, f * 0.6, 0.7], round: 0.03 },
        ] },
        { name: 'walls', material: 'plaster', color, pattern: 'noise', color2: new THREE_NODE.Color(hexOf(color, 0xe8dcc8)).multiplyScalar(0.86).getHex(), patternScale: 1.2, shapes: [
          { type: 'box', at: [0, f + h / 2, 0], size: [w, h, d], round: 0.02 },
          { type: 'box', at: [0, f + h + rh / 2, 0], size: [w - 0.02, rh, d], round: 0.01 },
          { type: 'plane', normal: [0, Math.cos(a * DEG), Math.sin(a * DEG)], at: [0, f + h + rh - 0.04, 0] },
          { type: 'plane', normal: [0, Math.cos(a * DEG), -Math.sin(a * DEG)], at: [0, f + h + rh - 0.04, 0] },
          { type: 'box', at: [0, f + 1.05, d / 2], size: [1.0, 2.1, 0.34], op: 'subtract', round: 0.01 },
          ...windows.map((q) => ({ type: 'box', ...q, op: 'subtract', round: 0.01 })),
        ] },
        { name: 'roof', material: 'roof-tile', color: 0x9c4a32, pattern: 'noise', color2: 0x7a3524, patternScale: 3, noise: { amp: 0.014, freq: 17, kind: 'rows' }, detail: 'low', shapes: [
          { type: 'box', at: [0, f + h + rh / 2 + 0.06, d / 4 + 0.1], size: [w + 0.7, 0.12, slope], rotate: [a, 0, 0], round: 0.03 },
          { type: 'box', at: [0, f + h + rh / 2 + 0.06, -d / 4 - 0.1], size: [w + 0.7, 0.12, slope], rotate: [-a, 0, 0], round: 0.03 },
          { type: 'capsule', from: [-w / 2 - 0.35, f + h + rh + 0.06, 0], to: [w / 2 + 0.35, f + h + rh + 0.06, 0], r: 0.09 },
        ] },
        { name: 'chimney', material: 'brick', color: 0x8a4a3a, pattern: 'noise', color2: 0x6a3428, patternScale: 5, noise: { amp: 0.006, freq: 50, kind: 'rows' }, shapes: [
          { type: 'box', at: [w * 0.27, f + h + rh * 0.8, -d * 0.16], size: [0.55, rh * 1.25, 0.55], round: 0.015 },
          { type: 'box', at: [w * 0.27, f + h + rh * 1.44, -d * 0.16], size: [0.68, 0.1, 0.68], round: 0.02 },
        ] },
        { name: 'door', material: 'wood', color: 0x5a3a22, shapes: [
          { type: 'box', at: [0, f + 1.03, d / 2 - 0.08], size: [0.96, 2.06, 0.07], round: 0.01 },
          { type: 'box', at: [-0.21, f + 1.45, d / 2 - 0.045], size: [0.3, 0.75, 0.03], op: 'subtract', round: 0.01, mirror: 'x' },
          { type: 'box', at: [-0.21, f + 0.5, d / 2 - 0.045], size: [0.3, 0.65, 0.03], op: 'subtract', round: 0.01, mirror: 'x' },
        ] },
        ...windows.map((q, i) => { const alongX = q.size[0] > q.size[2], tt = 0.06; const out = [q.size[0], q.size[1], q.size[2]]; const inner = alongX ? [out[0] - tt * 2, out[1] - tt * 2, 1] : [1, out[1] - tt * 2, out[2] - tt * 2]; const dz = alongX ? [0, 0, -Math.sign(q.at[2]) * 0.06] : [-Math.sign(q.at[0]) * 0.06, 0, 0];
          const c = q.at.map((v, j) => v + dz[j]);
          return { name: `frame${i + 1}`, material: 'plastic', color: 0xf2f0ea, shapes: [{ type: 'box', at: c, size: alongX ? [out[0], out[1], 0.1] : [0.1, out[1], out[2]], round: 0.008 }, { type: 'box', at: c, size: inner, op: 'subtract' },
            { type: 'box', at: c, size: alongX ? [0.05, out[1], 0.06] : [0.06, out[1], 0.05] }, { type: 'box', at: c, size: alongX ? [out[0], 0.05, 0.06] : [0.06, 0.05, out[2]] }] }; }),
        { name: 'knob', material: 'gold', color: 0xffc356, shapes: [{ type: 'sphere', at: [0.36, f + 1.0, d / 2 - 0.03], r: 0.04 }, { type: 'cylinder', from: [0.36, f + 1.0, d / 2 - 0.08], to: [0.36, f + 1.0, d / 2 - 0.03], r: 0.02 }] },
        { name: 'glass', material: lit ? 'emissive' : 'tinted-glass', color: lit ? 0xffd27a : 0x9fc4d8, ...(lit ? { emissive: 1.6 } : {}), shapes: windows.map((q) => { const alongX = q.size[0] > q.size[2]; const c = q.at.map((v, i) => v + (alongX ? [0, 0, -Math.sign(q.at[2]) * 0.09] : [-Math.sign(q.at[0]) * 0.09, 0, 0])[i]); return { type: 'box', at: c, size: alongX ? [q.size[0] - 0.04, q.size[1] - 0.04, 0.09] : [0.09, q.size[1] - 0.04, q.size[2] - 0.04], round: 0.01 }; }) },
      ],
    };
  },

  table: ({ width = 2, depth = 1, height = 0.8, color = 0x8b5a2b }) => {
    const w = width, d = depth, h = height, c = hexOf(color, 0x8b5a2b), dark = new THREE_NODE.Color(c).multiplyScalar(0.7).getHex();
    return { name: 'table', detail: 'medium', parts: [
      { name: 'top', material: 'wood', color: c, color2: dark, pattern: 'stripes', patternAxis: 'z', patternScale: 9, shapes: [{ type: 'box', at: [0, h - 0.025, 0], size: [w, 0.05, d], round: 0.012 }] },
      { name: 'frame', material: 'wood', color: dark, shapes: [
        { type: 'box', at: [0, h - 0.1, d / 2 - 0.09], size: [w - 0.22, 0.09, 0.03], round: 0.006, mirror: 'z' },
        { type: 'box', at: [w / 2 - 0.09, h - 0.1, 0], size: [0.03, 0.09, d - 0.22], round: 0.006, mirror: 'x' },
        { type: 'cone', from: [w / 2 - 0.09, h - 0.05, d / 2 - 0.09], to: [w / 2 - 0.09, 0, d / 2 - 0.09], r: [0.036, 0.022], round: 0.004, mirror: 'xz' },
      ] },
    ] };
  },

  chair: ({ size = 0.5, color = 0x8b5a2b }) => {
    const s = size / 0.5, c = hexOf(color, 0x8b5a2b), dark = new THREE_NODE.Color(c).multiplyScalar(0.72).getHex();
    return { name: 'chair', detail: 'medium', parts: [
      { name: 'seat', material: 'wood', color: c, color2: dark, pattern: 'stripes', patternAxis: 'x', patternScale: 14, shapes: [
        { type: 'box', at: [0, 0.45 * s, 0], size: [0.46 * s, 0.045 * s, 0.44 * s], round: 0.015 * s },
        { type: 'ellipsoid', at: [0, 0.5 * s, 0.02 * s], r: [0.19 * s, 0.035 * s, 0.17 * s], op: 'subtract', blend: 0.01 * s },
      ] },
      { name: 'frame', material: 'wood', color: dark, shapes: [
        { type: 'cone', from: [0.19 * s, 0.44 * s, 0.18 * s], to: [0.2 * s, 0, 0.2 * s], r: [0.022 * s, 0.015 * s], mirror: 'x' },
        { type: 'capsule', from: [0.19 * s, 0, -0.2 * s], to: [0.19 * s, 0.5 * s, -0.19 * s], r: [0.017 * s, 0.022 * s], mirror: 'x' },
        { type: 'capsule', from: [0.19 * s, 0.5 * s, -0.19 * s], to: [0.19 * s, 0.98 * s, -0.25 * s], r: [0.022 * s, 0.016 * s], mirror: 'x' },
        { type: 'box', at: [0, 0.93 * s, -0.245 * s], size: [0.42 * s, 0.09 * s, 0.03 * s], round: 0.012 * s, rotate: [-7, 0, 0] },
        { type: 'box', at: [0, 0.72 * s, -0.22 * s], size: [0.05 * s, 0.36 * s, 0.018 * s], round: 0.007 * s, rotate: [-7, 0, 0], array: { count: 3, step: [0.12 * s, 0, 0] } },
        { type: 'box', at: [-0.12 * s, 0.72 * s, -0.22 * s], size: [0.05 * s, 0.36 * s, 0.018 * s], round: 0.007 * s, rotate: [-7, 0, 0] },
        { type: 'capsule', from: [-0.19 * s, 0.2 * s, 0.19 * s], to: [0.19 * s, 0.2 * s, 0.19 * s], r: 0.012 * s },
        { type: 'capsule', from: [0.19 * s, 0.2 * s, -0.19 * s], to: [0.195 * s, 0.2 * s, 0.19 * s], r: 0.012 * s, mirror: 'x' },
      ] },
    ] };
  },

  lamp: ({ height = 3.5, light = true, intensity = 6 }) => {
    const h = height, top = h - 0.05;
    return { name: 'street lamp', detail: 'medium',
      parts: [
        { name: 'post', material: 'metal', color: 0x23262b, pattern: 'noise', color2: 0x16181c, patternScale: 8, shapes: [
          { type: 'cone', from: [0, 0, 0], to: [0, 0.45, 0], r: [0.16, 0.075], round: 0.01 },
          { type: 'torus', at: [0, 0.45, 0], R: 0.08, tube: 0.022 },
          { type: 'cone', from: [0, 0.45, 0], to: [0, top - 0.5, 0], r: [0.06, 0.04] },
          { type: 'torus', at: [0, top - 0.5, 0], R: 0.05, tube: 0.018 },
          { type: 'cone', from: [0, top - 0.5, 0], to: [0, top - 0.32, 0], r: [0.04, 0.13], blend: 0.02 },
          { type: 'cylinder', from: [0, top - 0.32, 0], to: [0, top - 0.29, 0], r: 0.15, round: 0.006 },
          { type: 'cone', from: [0, top, 0], to: [0, top + 0.16, 0], r: [0.17, 0.03], round: 0.008 },
          { type: 'sphere', at: [0, top + 0.19, 0], r: 0.03 },
        ] },
        { name: 'cage', material: 'metal', color: 0x23262b, shapes: [{ type: 'capsule', from: [0.115, top - 0.3, 0.115], to: [0.1, top + 0.01, 0.1], r: 0.014, array: { count: 4, radial: 'y' } }] },
        { name: 'lantern', material: 'emissive', color: 0xffd28a, emissive: 3.5, noShadow: true, shapes: [{ type: 'cone', from: [0, top - 0.29, 0], to: [0, top, 0], r: [0.115, 0.095] }] },
      ],
      lights: light ? [{ at: [0, top - 0.15, 0], color: 0xffc979, intensity, distance: h * 4 }] : [],
    };
  },

  mushroom: ({ height = 0.6, color = 0xd23b2f }) => {
    const h = height;
    return { name: 'mushroom', detail: 'medium', parts: [
      { name: 'stem', material: 'matte', color: 0xf3ead7, pattern: 'gradient', color2: 0xd9c9a8, shapes: [
        { type: 'capsule', from: [0, h * 0.06, 0], to: [0, h * 0.62, 0], r: [h * 0.13, h * 0.085] },
        { type: 'torus', at: [0, h * 0.45, 0], R: h * 0.1, tube: h * 0.022, blend: h * 0.02 },
        { type: 'plane', normal: [0, -1, 0], at: [0, 0, 0] },
      ] },
      { name: 'gills', material: 'matte', color: 0xe8dcc0, shapes: [
        { type: 'ellipsoid', at: [0, h * 0.63, 0], r: [h * 0.39, h * 0.07, h * 0.39] },
      ] },
      { name: 'cap', material: 'plastic', color, color2: 0xf5efe0, pattern: 'spots', patternScale: 9 / h, shapes: [
        { type: 'ellipsoid', at: [0, h * 0.66, 0], r: [h * 0.43, h * 0.33, h * 0.43] },
        { type: 'plane', normal: [0, -1, 0], at: [0, h * 0.655, 0], blend: h * 0.03 },
      ] },
    ] };
  },

  vase: ({ height = 1.4, color = 0x2f6f8f }) => {
    const h = height, c = hexOf(color, 0x2f6f8f);
    return { name: 'vase', detail: 'high', parts: [
      { name: 'body', material: 'ceramic', color: c, color2: new THREE_NODE.Color(c).multiplyScalar(0.55).getHex(), pattern: 'gradient', shapes: [
        { type: 'cylinder', from: [0, 0, 0], to: [0, h * 0.05, 0], r: h * 0.14, round: h * 0.01 },
        { type: 'ellipsoid', at: [0, h * 0.36, 0], r: [h * 0.27, h * 0.34, h * 0.27], blend: h * 0.05 },
        { type: 'cone', from: [0, h * 0.6, 0], to: [0, h * 0.93, 0], r: [h * 0.14, h * 0.085], blend: h * 0.1 },
        { type: 'torus', at: [0, h * 0.95, 0], R: h * 0.105, tube: h * 0.03, blend: h * 0.04 },
        { type: 'capsule', from: [0, h * 0.32, 0], to: [0, h * 1.2, 0], r: [h * 0.2, h * 0.075], op: 'subtract', blend: h * 0.02 },
        { type: 'torus', at: [0, h * 0.62, 0], R: h * 0.165, tube: h * 0.012, blend: h * 0.01 },
      ] },
    ] };
  },

  crystal: ({ height = 1.2, color = 0x8fd3ff }) => {
    const h = height;
    const shard = (name, hh, w, rotate, move) => ({ name, material: 'ice', color, color2: 0xffffff, pattern: 'gradient', rotate, move, shapes: [
      { type: 'box', at: [0, hh / 2, 0], size: [w, hh, w * 2.2], round: 0 },
      { type: 'box', at: [0, hh / 2, 0], size: [w, hh * 1.2, w * 2.2], rotate: [0, 60, 0], op: 'intersect', round: 0 },
      { type: 'box', at: [0, hh / 2, 0], size: [w, hh * 1.2, w * 2.2], rotate: [0, 120, 0], op: 'intersect', round: 0 },
      { type: 'plane', normal: [0.9, 0.62, 0], at: [0, hh, 0], array: { count: 6, radial: 'y' } },
    ] });
    return { name: 'crystal cluster', detail: 'medium', ground: 'cut', parts: [
      shard('shard1', h, h * 0.2, [4, 0, -3], [0, 0, 0]),
      shard('shard2', h * 0.62, h * 0.14, [8, 40, 24], [h * 0.16, 0, h * 0.04]),
      shard('shard3', h * 0.5, h * 0.12, [-20, 10, -22], [-h * 0.15, 0, h * 0.08]),
      shard('shard4', h * 0.4, h * 0.1, [26, 80, 6], [0.02 * h, 0, -h * 0.16]),
      { name: 'base', material: 'stone', color: 0x6a6660, pattern: 'noise', color2: 0x4a4744, patternScale: 14 / h, noise: { amp: h * 0.012, freq: 22 / h, kind: 'n' }, shapes: [{ type: 'ellipsoid', at: [0, 0, 0], r: [h * 0.3, h * 0.09, h * 0.27] }] },
    ] };
  },

  robot: ({ height = 2, color = 0xb8c4d0 }) => {
    const u = height / 10, c = hexOf(color, 0xb8c4d0), joint = 0x2a2d33, glow = 0x33ddff;
    const arm = (sx) => [
      { type: 'sphere', at: [sx * u * 2.55, u * 7.3, 0], r: u * 0.62, bone: sx > 0 ? 'armL' : 'armR' },
      { type: 'capsule', from: [sx * u * 2.7, u * 7.1, 0], to: [sx * u * 2.8, u * 5.5, 0], r: [u * 0.45, u * 0.36], bone: sx > 0 ? 'armL' : 'armR', blend: u * 0.1 },
      { type: 'cylinder', from: [sx * u * 2.8, u * 5.2, -u * 0.5], to: [sx * u * 2.8, u * 5.2, u * 0.5], r: u * 0.3, round: u * 0.04, bone: sx > 0 ? 'foreL' : 'foreR' },
      { type: 'cone', from: [sx * u * 2.8, u * 5.1, 0], to: [sx * u * 2.85, u * 3.6, u * 0.1], r: [u * 0.36, u * 0.48], round: u * 0.05, bone: sx > 0 ? 'foreL' : 'foreR' },
    ];
    const leg = (sx) => [
      { type: 'sphere', at: [sx * u * 1.05, u * 4.2, 0], r: u * 0.6, bone: sx > 0 ? 'legL' : 'legR' },
      { type: 'cone', from: [sx * u * 1.05, u * 4.1, 0], to: [sx * u * 1.1, u * 2.45, 0], r: [u * 0.62, u * 0.45], round: u * 0.05, bone: sx > 0 ? 'legL' : 'legR' },
      { type: 'cylinder', from: [sx * u * 1.1, u * 2.2, -u * 0.55], to: [sx * u * 1.1, u * 2.2, u * 0.55], r: u * 0.36, round: u * 0.04, bone: sx > 0 ? 'shinL' : 'shinR' },
      { type: 'cone', from: [sx * u * 1.1, u * 2.1, 0], to: [sx * u * 1.12, u * 0.5, 0], r: [u * 0.42, u * 0.58], round: u * 0.06, bone: sx > 0 ? 'shinL' : 'shinR' },
      { type: 'box', at: [sx * u * 1.12, u * 0.24, u * 0.3], size: [u * 1.25, u * 0.48, u * 2.2], round: u * 0.14, bone: sx > 0 ? 'shinL' : 'shinR' },
    ];
    return {
      name: 'robot', detail: 'high',
      bones: [
        { name: 'hips', at: [0, u * 4.5, 0] }, { name: 'chest', parent: 'hips', at: [0, u * 5.4, 0] }, { name: 'head', parent: 'chest', at: [0, u * 8.1, 0] },
        { name: 'armL', parent: 'chest', at: [u * 2.55, u * 7.3, 0] }, { name: 'foreL', parent: 'armL', at: [u * 2.8, u * 5.2, 0] },
        { name: 'armR', parent: 'chest', at: [-u * 2.55, u * 7.3, 0] }, { name: 'foreR', parent: 'armR', at: [-u * 2.8, u * 5.2, 0] },
        { name: 'legL', parent: 'hips', at: [u * 1.05, u * 4.2, 0] }, { name: 'shinL', parent: 'legL', at: [u * 1.1, u * 2.2, 0] },
        { name: 'legR', parent: 'hips', at: [-u * 1.05, u * 4.2, 0] }, { name: 'shinR', parent: 'legR', at: [-u * 1.1, u * 2.2, 0] },
      ],
      motions: [
        { bone: 'head', axis: 'y', amp: 22, speed: 0.6, mode: 'idle' }, { bone: 'chest', axis: 'y', amp: 4, speed: 1.2, mode: 'idle' },
        { bone: 'armL', axis: 'x', amp: 6, speed: 1.2, mode: 'idle' }, { bone: 'armR', axis: 'x', amp: 6, speed: 1.2, phase: 3.14, mode: 'idle' },
        ...['walk', 'run'].flatMap((mode) => { const sp = mode === 'run' ? 9 : 5.5, a = mode === 'run' ? 42 : 26; return [
          { bone: 'legL', axis: 'x', amp: a, speed: sp, mode }, { bone: 'legR', axis: 'x', amp: a, speed: sp, phase: 3.14, mode },
          { bone: 'shinL', axis: 'x', amp: a * 0.6, speed: sp, phase: 1.3, offset: a * 0.6, mode }, { bone: 'shinR', axis: 'x', amp: a * 0.6, speed: sp, phase: 4.44, offset: a * 0.6, mode },
          { bone: 'armL', axis: 'x', amp: a * 0.8, speed: sp, phase: 3.14, mode }, { bone: 'armR', axis: 'x', amp: a * 0.8, speed: sp, mode },
          { bone: 'foreL', axis: 'x', amp: 8, speed: sp, offset: -25, mode }, { bone: 'foreR', axis: 'x', amp: 8, speed: sp, offset: -25, mode },
          { bone: 'chest', axis: 'y', amp: 6, speed: sp, mode },
        ]; }),
        { bone: 'armR', axis: 'z', amp: 0, speed: 1, offset: -140, mode: 'wave' }, { bone: 'foreR', axis: 'z', amp: 28, speed: 8, offset: -20, mode: 'wave' }, { bone: 'head', axis: 'z', amp: 0, speed: 1, offset: 6, mode: 'wave' },
      ],
      parts: [
        { name: 'shell', material: 'metal', color: c, color2: new THREE_NODE.Color(c).multiplyScalar(0.8).getHex(), pattern: 'noise', patternScale: 3 / u, shapes: [
          { type: 'box', at: [0, u * 6.35, 0], size: [u * 4.1, u * 2.9, u * 2.5], round: u * 0.45, bone: 'chest' },
          { type: 'box', at: [0, u * 6.6, u * 1.2], size: [u * 2.6, u * 1.5, u * 0.5], round: u * 0.18, bone: 'chest', blend: u * 0.08 },
          { type: 'box', at: [0, u * 6.6, u * 1.48], size: [u * 2.0, u * 0.12, u * 0.3], op: 'subtract', array: { count: 4, step: [0, -u * 0.3, 0] }, round: u * 0.02 },
          { type: 'box', at: [0, u * 4.55, 0], size: [u * 3.0, u * 1.0, u * 1.9], round: u * 0.3, bone: 'hips' },
          { type: 'box', at: [0, u * 8.95, 0], size: [u * 2.5, u * 1.9, u * 2.2], round: u * 0.45, bone: 'head' },
          { type: 'box', at: [0, u * 9.05, u * 1.05], size: [u * 1.9, u * 0.7, u * 0.5], op: 'subtract', round: u * 0.15 },
          { type: 'capsule', from: [u * 0.7, u * 9.8, -u * 0.2], to: [u * 0.95, u * 10.8, -u * 0.3], r: u * 0.06, bone: 'head' },
          { type: 'sphere', at: [u * 0.95, u * 10.85, -u * 0.3], r: u * 0.13, bone: 'head' },
          { type: 'cylinder', from: [u * 1.28, u * 8.9, 0], to: [u * 1.5, u * 8.9, 0], r: u * 0.42, round: u * 0.05, bone: 'head', mirror: 'x' },
          ...arm(1).slice(3), ...arm(-1).slice(3), ...leg(1).slice(3), ...leg(-1).slice(3),
          ...[1, -1].flatMap((sx) => [{ ...arm(sx)[1] }, { ...leg(sx)[1] }]),
        ] },
        { name: 'joints', material: 'rubber', color: joint, shapes: [
          { type: 'cylinder', from: [0, u * 4.95, 0], to: [0, u * 5.2, 0], r: u * 0.95, bone: 'chest', round: u * 0.05 },
          { type: 'cylinder', from: [0, u * 7.75, 0], to: [0, u * 8.1, 0], r: u * 0.5, bone: 'head', round: u * 0.04 },
          ...[1, -1].flatMap((sx) => [arm(sx)[0], arm(sx)[2], leg(sx)[0], leg(sx)[2]]),
          ...[1, -1].flatMap((sx) => [-0.22, 0.22].map((dz) => ({ type: 'capsule', from: [sx * u * 2.85, u * 3.6, u * 0.1 + dz * u], to: [sx * u * 2.85, u * 2.95, u * 0.1 + dz * u * 1.4], r: [u * 0.14, u * 0.09], bone: sx > 0 ? 'foreL' : 'foreR' }))),
        ] },
        { name: 'lights', material: 'emissive', color: glow, emissive: 3, noShadow: true, shapes: [
          { type: 'box', at: [0, u * 9.05, u * 0.92], size: [u * 1.8, u * 0.6, u * 0.3], round: u * 0.12, bone: 'head' },
          { type: 'sphere', at: [0, u * 5.75, u * 1.22], r: u * 0.28, bone: 'chest' },
        ] },
      ],
    };
  },
};
