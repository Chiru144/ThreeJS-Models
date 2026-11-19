// Quality agent: an art-director / tech-artist critic. It inspects the built
// model (not the code): mesh integrity, form, skinning under animation and
// surfacing, then scores it so weak models are caught and explained.
import * as THREE from 'three';
import { Agent, SubAgent, assert } from '../core/agent.js';
import { buildModel } from '../core/sandbox.js';

// fur shells and cards (eyelids, lashes, brows: deliberately open sheets) are not solid surfaces
const meshesOf = (obj) => { const out = []; obj.traverse((o) => { if (o.isMesh && !o.userData.shell && !o.userData.card && o.geometry?.index) out.push(o); }); return out; };

function inspectMesh(obj) {
  let tris = 0, verts = 0, degenerate = 0, boundary = 0, nonManifold = 0, flipped = 0, edges = 0;
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3(), vn = new THREE.Vector3();
  for (const m of meshesOf(obj)) {
    const g = m.geometry, idx = g.index.array, pos = g.attributes.position, nor = g.attributes.normal, nv = pos.count;
    tris += idx.length / 3; verts += nv;
    const sculpted = !!g.attributes.skinIndex || g.attributes.color; // only sculpted meshes are expected to be closed
    const em = new Map();
    for (let i = 0; i < idx.length; i += 3) {
      const i0 = idx[i], i1 = idx[i + 1], i2 = idx[i + 2];
      a.fromBufferAttribute(pos, i0); b.fromBufferAttribute(pos, i1); c.fromBufferAttribute(pos, i2);
      if (sculpted) for (const [p, q] of [[i0, i1], [i1, i2], [i2, i0]]) { const k = p < q ? p * nv + q : q * nv + p; em.set(k, (em.get(k) || 0) + 1); }
      n.subVectors(b, a).cross(vn.subVectors(c, a));
      if (n.lengthSq() < 1e-20) { degenerate++; continue; }
      if (nor) { vn.set(nor.getX(i0) + nor.getX(i1) + nor.getX(i2), nor.getY(i0) + nor.getY(i1) + nor.getY(i2), nor.getZ(i0) + nor.getZ(i1) + nor.getZ(i2)); if (n.normalize().dot(vn.normalize()) < -0.3) flipped++; }
    }
    for (const v of em.values()) { edges++; if (v === 1) boundary++; else if (v > 2) nonManifold++; }
  }
  return { tris, verts, degenerate, boundary, nonManifold, flipped, edges, watertight: boundary === 0 };
}

function inspectForm(obj) {
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3();
  let debris = 0, parts = 0;
  for (const m of meshesOf(obj)) {
    const g = m.geometry; if (!g.boundingBox) g.computeBoundingBox();
    box.union(g.boundingBox.clone().applyMatrix4(m.isSkinnedMesh ? new THREE.Matrix4() : m.matrixWorld));
    if (!g.attributes.skinWeight) { parts++; continue; } // only sculpted meshes are analysed for debris
    // connected components: tiny islands are sculpting debris
    const nv = g.attributes.position.count, parent = new Int32Array(nv).map((_, i) => i), idx = g.index.array;
    const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
    for (let i = 0; i < idx.length; i += 3) { const r0 = find(idx[i]), r1 = find(idx[i + 1]), r2 = find(idx[i + 2]); if (r1 !== r0) parent[r1] = r0; if (r2 !== r0) parent[r2] = r0; }
    const sizes = new Map();
    const used = new Uint8Array(nv); for (let i = 0; i < idx.length; i++) used[idx[i]] = 1;
    for (let v = 0; v < nv; v++) if (used[v]) { const r = find(v); sizes.set(r, (sizes.get(r) || 0) + 1); }
    parts += sizes.size;
    for (const s of sizes.values()) if (s < Math.max(12, nv * 0.002)) debris++;
  }
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  return { height: +size.y.toFixed(3), width: +size.x.toFixed(3), depth: +size.z.toFixed(3), minY: +box.min.y.toFixed(3), offCentre: +(Math.hypot(centre.x, centre.z) / Math.max(size.x, size.z, 1e-6)).toFixed(3), debris, islands: parts };
}

const RIG_MODES = ['idle', 'walk', 'run', 'wave', 'dance', 'fly', 'swim', 'slither'];
function inspectSkin(obj) {
  const skinned = meshesOf(obj).filter((m) => m.isSkinnedMesh);
  if (!skinned.length) return { skinned: false };
  let unnormalised = 0, maxStretch = 1, sum = 0, n = 0, over = 0;
  const samples = [];
  const used = new Set();
  const rig = obj.userData.rig, p = new THREE.Vector3(), q = new THREE.Vector3(), rp = new THREE.Vector3(), rq = new THREE.Vector3();
  for (const m of skinned) {
    const g = m.geometry, sw = g.attributes.skinWeight, si = g.attributes.skinIndex, pos = g.attributes.position, idx = g.index.array;
    for (let v = 0; v < sw.count; v++) { const s = sw.getX(v) + sw.getY(v) + sw.getZ(v) + sw.getW(v); if (Math.abs(s - 1) > 0.01) unnormalised++; for (let k = 0; k < 4; k++) if (sw.getComponent(v, k) > 0.05) used.add(si.getComponent(v, k)); }
    if (!rig) continue;
    // stretch test: pose the rig and compare edge lengths with the bind pose
    const step = Math.max(3, Math.floor(idx.length / 3 / 1500) * 3);
    for (const mode of RIG_MODES) for (const t of [0.4, 1.3]) {
      rig(t, mode); obj.updateMatrixWorld(true); m.skeleton.update();
      for (let i = 0; i < idx.length; i += step) {
        const i0 = idx[i], i1 = idx[i + 1];
        rp.fromBufferAttribute(pos, i0); rq.fromBufferAttribute(pos, i1);
        const rest = rp.distanceTo(rq); if (rest < 1e-9) continue;
        p.copy(rp); q.copy(rq); m.applyBoneTransform(i0, p); m.applyBoneTransform(i1, q);
        const s = p.distanceTo(q) / rest; sum += s; n++; samples.push(s);
        if (s > maxStretch) maxStretch = s; if (s > 2.5) over++;
      }
    }
  }
  if (rig) { rig(0, 'idle'); obj.updateMatrixWorld(true); }
  const bones = skinned[0].skeleton.bones.length;
  samples.sort((x, y) => x - y);
  const p999 = samples.length ? samples[Math.min(samples.length - 1, Math.floor(samples.length * 0.999))] : 1;
  // `stretch` = 99.9th percentile over all poses (robust to one sliver edge); maxStretch kept for diagnosis
  return { skinned: true, bones, bonesUsed: used.size, unnormalised, stretch: +p999.toFixed(2), maxStretch: +maxStretch.toFixed(2), overStretched: n ? +(over / n).toFixed(4) : 0, rigged: !!rig };
}

function inspectSurface(obj) {
  const mats = new Set();
  let lum = 0, lum2 = 0, n = 0, dark = 0, basic = 0, outOfRange = 0, coloured = 0, meshes = 0;
  for (const m of meshesOf(obj)) {
    meshes++;
    for (const mat of [].concat(m.material)) {
      mats.add(mat);
      if (mat.isMeshBasicMaterial) basic++;
      if (mat.roughness !== undefined && (mat.roughness < 0 || mat.roughness > 1 || mat.metalness < 0 || mat.metalness > 1)) outOfRange++;
    }
    const col = m.geometry.attributes.color;
    if (!col) continue;
    coloured++;
    const step = Math.max(1, Math.floor(col.count / 4000));
    for (let v = 0; v < col.count; v += step) { const l = 0.2126 * col.getX(v) + 0.7152 * col.getY(v) + 0.0722 * col.getZ(v); lum += l; lum2 += l * l; n++; if (l < 0.004) dark++; }
  }
  const mean = n ? lum / n : 0, sd = n ? Math.sqrt(Math.max(0, lum2 / n - mean * mean)) : 0;
  return { materials: mats.size, basic, outOfRange, painted: coloured, meshes, variation: +(mean ? sd / mean : 0).toFixed(3), crushed: n ? +(dark / n).toFixed(3) : 0 };
}

/** Turn inspections into a score, a grade and concrete notes. */
function score({ mesh, form, skin, surface, expect = {} }) {
  let s = 100; const notes = [];
  const hit = (pts, msg) => { s -= pts; notes.push(msg); };
  if (mesh.tris === 0) return { score: 0, grade: 'F', weak: true, notes: ['no geometry'] };
  if (mesh.boundary > 0) hit(mesh.boundary / Math.max(1, mesh.edges) > 0.01 ? 20 : 10, `${mesh.boundary} open edges (mesh is not watertight)`);
  if (mesh.nonManifold > 0) hit(Math.min(8, 1 + mesh.nonManifold * 0.25), `${mesh.nonManifold} non-manifold edges`);
  if (mesh.degenerate / mesh.tris > 0.002) hit(6, `${mesh.degenerate} degenerate triangles`);
  if (mesh.flipped / mesh.tris > 0.003) hit(Math.min(15, Math.round(mesh.flipped / mesh.tris * 600)), `${(mesh.flipped / mesh.tris * 100).toFixed(1)}% of faces fold against their normals (a feature is thinner than the sculpt grid)`);
  if (form.debris > 0) hit(Math.min(12, form.debris * 3), `${form.debris} tiny disconnected fragment(s): a shape is thinner than the grid or a cut left debris`);
  if (expect.grounded !== false && Math.abs(form.minY) > Math.max(0.02, form.height * 0.03)) hit(8, `not grounded (lowest point at y=${form.minY})`);
  if (expect.realistic !== false) {
    if (mesh.tris < 400) hit(25, `only ${mesh.tris} triangles: reads as a primitive, not a model`);
    else if (mesh.tris < 2500) hit(10, `${mesh.tris} triangles is thin for a hero asset`);
    if (surface.painted === 0) hit(8, 'no painted detail (flat material colours only)');
    else if (surface.variation < 0.02) hit(5, 'surface colour is perfectly flat: add paint variation / ambient occlusion');
  }
  if (surface.crushed > 0.25) hit(5, `${Math.round(surface.crushed * 100)}% of the surface is crushed to black (over-occluded)`);
  if (surface.basic) hit(8, 'unlit MeshBasicMaterial used');
  if (surface.outOfRange) hit(5, 'PBR values outside 0..1');
  if (skin.skinned) {
    if (skin.unnormalised) hit(10, `${skin.unnormalised} vertices have skin weights that do not sum to 1`);
    if (skin.overStretched > 0.01) hit(10, `${(skin.overStretched * 100).toFixed(1)}% of edges stretch >2.5× when animated (99.9th pct ${skin.stretch}×): joints tear`);
    else if (skin.stretch > 5) hit(4, `some edges stretch ${skin.stretch}× at the extreme of an animation`);
    if (skin.bones > 4 && skin.bonesUsed / skin.bones < 0.5) hit(5, `only ${skin.bonesUsed}/${skin.bones} bones influence the mesh`);
    if (!skin.rigged) hit(3, 'skeleton present but no animation rig');
  } else if (expect.rigged) hit(15, 'expected a skinned, rigged model');
  s = Math.max(0, Math.round(s));
  const grade = s >= 90 ? 'A' : s >= 80 ? 'B' : s >= 70 ? 'C' : s >= 55 ? 'D' : 'F';
  return { score: s, grade, weak: s < 70, notes };
}

const cache = new Map();

export class QualityAgent extends Agent {
  constructor() {
    super({
      name: 'quality',
      role: 'Critic: inspects the built model (mesh, form, skinning under animation, surfacing) and scores it so weak models are caught.',
      subagents: [
        new SubAgent({
          name: 'mesh-inspector',
          description: 'Watertightness, non-manifold edges, degenerate triangles, flipped normals.',
          run: (obj) => inspectMesh(obj),
          test: () => {
            const good = inspectMesh(buildModel('rock', {}).obj);
            assert(good.watertight && good.flipped === 0 && good.tris > 1000, JSON.stringify(good));
            const g = new THREE.SphereGeometry(1, 8, 6).toNonIndexed(); g.setIndex([...Array(g.attributes.position.count).keys()]); g.setAttribute('color', g.attributes.position.clone());
            const open = inspectMesh(new THREE.Mesh(g, new THREE.MeshStandardMaterial()));
            assert(open.boundary > 0, 'unwelded soup must be reported as open');
          },
        }),
        new SubAgent({
          name: 'form-inspector',
          description: 'Dimensions, grounding, centring, floating fragments.',
          run: (obj) => inspectForm(obj),
          test: () => {
            const f = inspectForm(buildModel('rock', { size: 1 }).obj);
            assert(f.debris === 0 && f.height > 0.3 && f.islands === 1, JSON.stringify(f));
          },
        }),
        new SubAgent({
          name: 'skin-inspector',
          description: 'Weight normalisation, bone coverage and a stretch test in every animation pose.',
          run: (obj) => inspectSkin(obj),
          test: () => {
            const s = inspectSkin(buildModel('fish', { length: 0.4 }).obj);
            assert(s.skinned && s.unnormalised === 0 && s.stretch < 3 && s.bonesUsed >= 3, JSON.stringify(s));
            assert(inspectSkin(buildModel('rock', {}).obj).skinned === false);
          },
        }),
        new SubAgent({
          name: 'surface-inspector',
          description: 'PBR sanity, painted detail, colour variation, crushed blacks.',
          run: (obj) => inspectSurface(obj),
          test: () => { const s = inspectSurface(buildModel('rock', {}).obj); assert(s.painted === 1 && s.variation > 0.02 && s.basic === 0, JSON.stringify(s)); },
        }),
        new SubAgent({
          name: 'scorer',
          description: 'Weighs every finding into a 0–100 score, a grade and actionable notes; below 70 is "weak".',
          run: (input) => score(input),
          test: () => {
            const base = { mesh: { tris: 20000, edges: 30000, boundary: 0, nonManifold: 0, degenerate: 0, flipped: 0 }, form: { debris: 0, minY: 0, height: 1 }, skin: { skinned: false }, surface: { painted: 1, variation: 0.1, crushed: 0, basic: 0, outOfRange: 0 } };
            assert(score(base).score === 100 && score(base).grade === 'A');
            const weak = score({ ...base, mesh: { ...base.mesh, tris: 12, boundary: 30, edges: 60 }, surface: { ...base.surface, painted: 0 } });
            assert(weak.weak && weak.notes.length >= 3, JSON.stringify(weak));
          },
        }),
      ],
    });
  }

  /** Inspect one built object. */
  async inspect(obj, expect, ctx) {
    const mesh = await this.delegate('mesh-inspector', obj, ctx);
    const form = await this.delegate('form-inspector', obj, ctx);
    const skin = await this.delegate('skin-inspector', obj, ctx);
    const surface = await this.delegate('surface-inspector', obj, ctx);
    const verdict = await this.delegate('scorer', { mesh, form, skin, surface, expect }, ctx);
    return { ...verdict, mesh, form, skin, surface };
  }

  /** Build (cached) and inspect a catalog model with the given params. */
  async inspectModel({ model, params, style = 'realistic', kind }, ctx) {
    const key = `${model}|${style}|${JSON.stringify(params)}`;
    if (!cache.has(key)) {
      const { obj } = buildModel(model, params, undefined, style);
      const organic = kind === 'character' || kind === 'creature';
      const simple = ['primitive', 'surface', 'backdrop', 'parametric'].includes(kind);
      cache.set(key, await this.inspect(obj, { realistic: style !== 'stylized' && !simple, rigged: organic && style !== 'stylized', grounded: !['stars', 'planet', 'fish', 'water'].includes(model) && !simple }, ctx));
      if (cache.size > 200) cache.delete(cache.keys().next().value);
    }
    return cache.get(key);
  }

  /** Scene pipeline: score every distinct model; warn about weak ones. */
  async handle(spec, ctx) {
    const reports = [];
    for (const o of spec.objects) {
      if (['surface', 'backdrop', 'primitive'].includes(o.kind)) continue;
      const r = await this.inspectModel({ model: o.model, params: o.params, style: spec.style, kind: o.kind }, ctx);
      o.quality = { score: r.score, grade: r.grade };
      reports.push({ id: o.id, score: r.score, grade: r.grade, notes: r.notes });
      if (r.weak) ctx.warn(`${o.id} is weak (${r.score}/100): ${r.notes.slice(0, 2).join('; ')}`);
    }
    const scores = reports.map((r) => r.score);
    return { reports, average: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null, min: scores.length ? Math.min(...scores) : null };
  }
}

export const formatQuality = (r) => `quality ${r.score}/100 (${r.grade}) · ${r.mesh.tris.toLocaleString('en-US')} tris · ${r.mesh.watertight ? 'watertight' : `${r.mesh.boundary} open edges`}${r.skin.skinned ? ` · ${r.skin.bonesUsed}/${r.skin.bones} bones · stretch ${r.skin.stretch}×` : ''}${r.notes.length ? ` · ${r.notes.slice(0, 3).join('; ')}` : ''}`;
