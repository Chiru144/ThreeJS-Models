// Professional pipeline: architect (blueprints), quality critic, surfacing, exporter.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import validator from 'gltf-validator';
import { Orchestrator } from '../src/core/orchestrator.js';
import { buildModel } from '../src/core/sandbox.js';
import { expandBlueprint, BLUEPRINT_LIBRARY } from '../src/library/blueprint.js';
import { readGLB } from '../src/core/gltf.js';

let dir, orch;
const ctx = { trace: [], warn() {}, note() {} };
before(async () => { dir = await mkdtemp(path.join(tmpdir(), 'forge-pro-')); orch = new Orchestrator({ baseDir: dir }); });
after(() => rm(dir, { recursive: true, force: true }));

const LANTERN = {
  name: 'lantern', height: 0.4,
  parts: [
    { name: 'frame', material: 'metal', color: '#2b2b30', shapes: [
      { type: 'cylinder', from: [0, 0, 0], to: [0, 0.06, 0], r: 0.4, round: 0.01 },
      { type: 'capsule', from: [0.3, 0.06, 0.3], to: [0.3, 0.9, 0.3], r: 0.03, mirror: 'xz' },
      { type: 'cone', from: [0, 0.9, 0], to: [0, 1.15, 0], r: [0.46, 0.08], round: 0.01 },
      { type: 'torus', at: [0, 1.25, 0], R: 0.09, tube: 0.02, axis: 'x' },
      { type: 'sphere', at: [0.2, 0.03, 0], r: 0.05, op: 'subtract', array: { count: 6, radial: 'y' } },
    ] },
    { name: 'glass', material: 'glass', color: '#fff2d0', shapes: [{ type: 'box', at: [0, 0.48, 0], size: [0.56, 0.84, 0.56], round: 0.02 }] },
    { name: 'flame', material: 'emissive', color: '#ffb040', emissive: 3, shapes: [{ type: 'ellipsoid', at: [0, 0.4, 0], r: [0.07, 0.16, 0.07] }] },
  ],
};

describe('architect: blueprints', () => {
  test('compiles mirrors, arrays, cuts; scales to the requested height and grounds the model', () => {
    const { bp, stats, issues } = expandBlueprint(LANTERN);
    assert.deepEqual(issues, []);
    assert.equal(stats.parts, 3);
    assert.ok(Math.abs(stats.size[1] - 0.4) < 1e-6, 'height');
    const frame = bp.parts[0].nodes;
    assert.equal(frame.filter((n) => n.s[0] === 'rc').length, 4, 'capsule mirrored across x and z');
    assert.equal(frame.filter((n) => n.op === 's').length, 6, 'radial array of cuts');
    assert.ok(bp.size.height > 0 && bp.parts.every((p) => p.cell > 0 && p.mat.props.vertexColors));
  });

  test('explains what is wrong with an invalid blueprint', async () => {
    await assert.rejects(() => orch.sculpt({ blueprint: { parts: [{ name: 'x', shapes: [{ type: 'box', at: [0, 0, 0] }, { type: 'wedge' }] }] } }), /needs size.*type must be one of/s);
    await assert.rejects(() => orch.sculpt({ blueprint: { parts: [] } }), /non-empty/);
  });

  test('design review tells a primitive from a crafted model', async () => {
    const weak = await orch.agents.architect.design({ parts: [{ name: 'a', shapes: [{ type: 'sphere', at: [0, 0, 0], r: 1 }] }] }, ctx);
    const strong = await orch.agents.architect.design(BLUEPRINT_LIBRARY.car({}), ctx);
    assert.ok(weak.review.craft < 60 && weak.review.notes.some((n) => /primitive/.test(n)));
    assert.ok(strong.review.craft >= 90, `car craft ${strong.review.craft}`);
  });

  test('flags floating parts and features too thin to sculpt', () => {
    const { issues } = expandBlueprint({ parts: [
      { name: 'body', shapes: [{ type: 'box', at: [0, 0.5, 0], size: [1, 1, 1] }] },
      { name: 'ufo', shapes: [{ type: 'sphere', at: [5, 5, 5], r: 0.2 }] },
      { name: 'hair', shapes: [{ type: 'capsule', from: [0, 1, 0], to: [0, 3, 0], r: 0.0005 }] },
    ] });
    assert.ok(issues.some((i) => /ufo.*floating/.test(i)) && issues.some((i) => /hair.*too thin/.test(i)), issues.join(' | '));
  });

  test('every built-in blueprint compiles cleanly and the critic grades it A', async () => {
    for (const name of Object.keys(BLUEPRINT_LIBRARY)) {
      const d = await orch.agents.architect.design(BLUEPRINT_LIBRARY[name]({}), ctx);
      assert.deepEqual(d.issues, [], `${name}: ${d.issues.join('; ')}`);
      const q = await orch.agents.quality.inspectModel({ model: 'blueprint', params: { bp: d.bp }, kind: 'blueprint' }, ctx);
      assert.ok(q.score >= 90, `${name} scored ${q.score}: ${q.notes.join('; ')}`);
    }
  });

  test('blueprints can be rigged: the robot has bones, motions and clips', async () => {
    const d = await orch.agents.architect.design(BLUEPRINT_LIBRARY.robot({}), ctx);
    const { obj } = buildModel('blueprint', { bp: d.bp });
    assert.equal(typeof obj.userData.rig, 'function');
    assert.ok(obj.userData.clips.map((c) => c[0]).includes('walk'));
    const hand = obj.getObjectByName('foreR'), p0 = hand.getWorldPosition(new (hand.position.constructor)()).clone();
    obj.userData.rig(0.4, 'wave'); obj.updateMatrixWorld(true);
    assert.ok(hand.getWorldPosition(new (hand.position.constructor)()).distanceTo(p0) > 0.2, 'arm moved');
  });

  test('scenes use sculpted blueprints for props, and custom blueprints work inside a spec', async () => {
    const r = await orch.build({ spec: { objects: [{ model: 'car', color: 'blue' }, { model: 'blueprint', blueprint: LANTERN, position: [3, 0, 0] }] }, write_files: false });
    assert.ok(r.ok, JSON.stringify(r.validation.runtime));
    assert.equal((r.files['scene.js'].match(/function makeBlueprint\(/g) || []).length, 1, 'shared factory emitted once');
    assert.ok(r.quality.average >= 90);
    const { compactSpec } = await import('../src/core/orchestrator.js');
    const c = compactSpec(r.spec);
    assert.ok(!JSON.stringify(c).includes('"nodes"') && c.objects[1].blueprint, 'compact spec keeps the source blueprint, not compiled data');
  });
});

describe('quality critic', () => {
  test('a sculpted person passes: watertight, weights normalised, no tearing in any pose', async () => {
    const q = await orch.agents.quality.inspectModel({ model: 'human', params: { sex: 'female', outfit: 'suit' }, kind: 'character' }, ctx);
    assert.ok(q.score >= 90, `${q.score}: ${q.notes.join('; ')}`);
    assert.ok(q.mesh.watertight && q.skin.unnormalised === 0 && q.skin.stretch < 3 && q.skin.bonesUsed === 17, JSON.stringify(q.skin));
  });

  test('catches weak models: primitive props score low with reasons', async () => {
    const q = await orch.agents.quality.inspectModel({ model: 'table', params: {}, style: 'stylized', kind: 'procedural' }, ctx);
    const real = await orch.agents.quality.inspect(buildModel('table', {}, undefined, 'stylized').obj, { realistic: true }, ctx);
    assert.ok(q.score > real.score, 'stylized models are judged as stylized');
    assert.ok(real.weak && real.notes.some((n) => /primitive|triangles/.test(n)), JSON.stringify(real.notes));
  });

  test('catches broken skinning (weights that do not sum to 1, tearing joints)', async () => {
    const { obj } = buildModel('fish', { length: 0.5 });
    const mesh = obj.children.find((o) => o.isSkinnedMesh), sw = mesh.geometry.attributes.skinWeight, si = mesh.geometry.attributes.skinIndex;
    for (let v = 0; v < sw.count; v += 2) { sw.setX(v, 0.3); si.setX(v, v % 4); }
    const q = await orch.agents.quality.inspect(obj, { rigged: true, grounded: false }, ctx);
    assert.ok(q.skin.unnormalised > 100 && q.notes.some((n) => /skin weights/.test(n)), JSON.stringify(q.notes));
    assert.ok(q.score < 90);
  });

  test('build summaries carry the quality line', async () => {
    const r = await orch.build({ prompt: 'a dog', write_files: false });
    assert.match(r.text(), /quality: avg \d+\/100/);
    assert.ok(r.spec.objects[0].quality.score >= 85);
  });
});

describe('surfacing', () => {
  test('hero mammals get shell fur; herds, reptiles and statues do not', async () => {
    const fur = async (prompt) => (await orch.build({ prompt, write_files: false })).spec.objects.filter((o) => o.params.fur).map((o) => o.params.species);
    assert.deepEqual(await fur('a cat and a dragon'), ['cat']);
    assert.deepEqual(await fur('12 sheep'), []);
    assert.deepEqual(await fur('a golden cat statue'), []);
  });

  test('fur shells are extra layers that never get instanced or exported as geometry weight', async () => {
    const r = await orch.build({ prompt: 'a brown bear', write_files: false, quality: 'high' });
    const src = r.files['scene.js'];
    assert.ok(src.includes('function furShells(') && src.includes('function detailize('));
    assert.equal(r.spec.objects[0].params.fur.shells, 12);
  });
});

describe('exporter', () => {
  test('GLB passes the Khronos validator with zero errors, with skin, clips and textures', async () => {
    const r = await orch.character({ description: 'a woman waving', out_dir: 'woman' });
    const glb = await readFile(path.join(dir, 'woman', 'model.glb'));
    const report = await validator.validateBytes(new Uint8Array(glb));
    assert.equal(report.issues.numErrors, 0, JSON.stringify(report.issues.messages.filter((m) => m.severity === 0).slice(0, 5)));
    const json = readGLB(glb);
    assert.equal(json.skins[0].joints.length, 17);
    assert.deepEqual(json.animations.map((a) => a.name), ['idle', 'walk', 'run', 'wave', 'dance']);
    assert.ok(json.images.length >= 1 && json.extensionsUsed.includes('KHR_materials_sheen'));
    assert.deepEqual(r.exported.summary.animations, ['idle', 'walk', 'run', 'wave', 'dance']);
  });

  test('forge_sculpt writes model.js, model.glb, blueprint.json and a preview', async () => {
    const r = await orch.sculpt({ blueprint: LANTERN, out_dir: 'lantern' });
    assert.ok(r.ok && r.quality.score >= 90, r.quality.notes.join('; '));
    for (const f of ['index.html', 'model.js', 'model.glb', 'blueprint.json']) await access(path.join(dir, 'lantern', f));
    const report = await validator.validateBytes(new Uint8Array(await readFile(path.join(dir, 'lantern', 'model.glb'))));
    assert.equal(report.issues.numErrors, 0);
  });

  test('scenes export to scene.glb on request', async () => {
    const r = await orch.build({ prompt: 'a table with a vase', out_dir: 'room', export_glb: true });
    assert.ok(r.ok);
    const json = readGLB(await readFile(path.join(dir, 'room', 'scene.glb')));
    assert.ok(json.meshes.length >= 3);
  });
});

test('adaptive optimisation keeps meshes watertight and much lighter', async () => {
  const H = await import('../src/library/helpers.js');
  const THREE = await import('three');
  // eslint-disable-next-line no-new-func
  const sculpt = new Function('THREE', `${H.sculpt.toString()}; return sculpt;`)(THREE);
  const nodes = [{ s: ['b', 0, 0, 0, 0.5, 0.3, 0.4, 0.02] }];
  const full = sculpt(nodes, { cell: 0.02 }), opt = sculpt(nodes, { cell: 0.02, simplify: 4 });
  assert.ok(opt.index.count < full.index.count * 0.35, `${full.index.count / 3} -> ${opt.index.count / 3}`);
  const edges = new Map(), idx = opt.index.array, n = opt.attributes.position.count;
  for (let i = 0; i < idx.length; i += 3) for (const [a, b] of [[idx[i], idx[i + 1]], [idx[i + 1], idx[i + 2]], [idx[i + 2], idx[i]]]) { const k = a < b ? a * n + b : b * n + a; edges.set(k, (edges.get(k) || 0) + 1); }
  assert.ok([...edges.values()].every((v) => v === 2), 'still a closed manifold');
});
