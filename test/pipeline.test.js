import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Orchestrator } from '../src/core/orchestrator.js';
import { MODELS } from '../src/library/models.js';
import { QUALITY } from '../src/library/presets.js';

let dir, orch;
before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'forge-test-'));
  orch = new Orchestrator({ baseDir: dir });
});
after(() => rm(dir, { recursive: true, force: true }));

describe('planner', () => {
  test('parses counts, colours, materials, motion, lighting and quality', async () => {
    const { spec } = await orch.plan({ prompt: '3 blue glass spheres, 40 pine trees and a floating gold robot at night, low poly' });
    const by = Object.fromEntries(spec.objects.map((o) => [o.model, o]));
    assert.equal(by.sphere.count, 3);
    assert.equal(by.sphere.material.preset, 'glass');
    assert.equal(by.tree.count, 40);
    assert.equal(by.robot.material.preset, 'gold');
    assert.equal(by.robot.animation.type, 'float');
    assert.equal(spec.lighting.preset, 'night');
    assert.equal(spec.quality, 'low');
  });
  test('falls back to a default hero with a warning when nothing is recognised', async () => {
    const { spec, ctx } = await orch.plan({ prompt: 'something abstract and lovely' });
    assert.equal(spec.objects[0].model, 'torusKnot');
    assert.ok(ctx.warnings.length > 0);
  });
  test('plans are cached', async () => {
    await orch.plan({ prompt: 'a cached cube' });
    assert.equal((await orch.plan({ prompt: 'a cached cube' })).cached, true);
  });
});

describe('build pipeline', () => {
  const prompts = [
    'a village at sunset with a red car and two rotating golden robots',
    'saturn with 80 asteroids orbiting in space',
    'studio product shot of a rotating glass vase, a gold torus knot and a chrome sphere',
    'a dense forest on hills with a cabin and a lake at night',
    'neon cyberpunk scene with 5 pulsing neon cubes',
    'a dining room',
  ];
  for (const prompt of prompts) {
    test(`builds and validates: "${prompt}"`, async () => {
      const r = await orch.build({ prompt, write_files: false });
      assert.ok(r.ok, JSON.stringify(r.validation, null, 1));
      assert.ok(r.validation.runtime.stats.meshes > 0);
      assert.ok(r.validation.budget.ok, r.validation.budget.issues.join(', '));
    });
  }

  test('writes index.html, scene.js and spec.json', async () => {
    const r = await orch.build({ prompt: 'a red box', out_dir: 'out/box' });
    const html = await readFile(path.join(dir, 'out/box/index.html'), 'utf8');
    const mod = await readFile(path.join(dir, 'out/box/scene.js'), 'utf8');
    const spec = JSON.parse(await readFile(path.join(dir, 'out/box/spec.json'), 'utf8'));
    assert.ok(html.includes('importmap') && html.includes('setAnimationLoop'));
    assert.ok(mod.startsWith('// ') && mod.includes('export function createScene'));
    assert.equal(spec.objects[0].model, 'box');
    assert.ok(r.text().includes('scene.js'));
  });

  test('accepts an explicit spec and the round-trips spec.json', async () => {
    const spec = {
      title: 'Spec test', quality: 'high', lighting: { preset: 'neon' },
      objects: [{ model: 'robot', color: 'cyan', animation: 'bounce' }, { model: 'crystal', count: 30, preset: 'neon', color: 'magenta' }, { model: 'sphere', position: [4, 1, 0], preset: 'chrome' }],
    };
    const r = await orch.build({ spec, write_files: false });
    assert.ok(r.ok);
    assert.equal(r.spec.objects.find((o) => o.model === 'crystal').instanced, true);
  });

  test('repeated objects are instanced: draw calls do not scale with count', async () => {
    const a = await orch.build({ spec: { objects: [{ model: 'tree', count: 10 }] }, write_files: false });
    const b = await orch.build({ spec: { objects: [{ model: 'tree', count: 400 }] }, write_files: false });
    assert.equal(a.validation.runtime.stats.drawCalls, b.validation.runtime.stats.drawCalls);
    assert.ok(b.validation.runtime.stats.instances > 1000);
  });

  test('budget planner trims counts to the quality triangle budget', async () => {
    const r = await orch.build({ spec: { quality: 'low', objects: [{ model: 'sphere', count: 5000, params: { detail: 128 } }] }, write_files: false });
    assert.ok(r.validation.runtime.stats.triangles <= QUALITY.low.triBudget * 1.05);
    assert.ok(r.ctx.warnings.some((w) => w.includes('triangle budget')));
  });

  test('output is deterministic for the same input', async () => {
    const p = { prompt: 'a forest with a house', write_files: false };
    const a = await orch.build(p);
    const b = await new Orchestrator({ baseDir: dir }).build(p);
    assert.equal(a.files['scene.js'], b.files['scene.js']);
  });

  test('only helpers and factories that are used get emitted (lean output)', async () => {
    const r = await orch.build({ spec: { objects: [{ model: 'box' }] }, write_files: false });
    const src = r.files['scene.js'];
    assert.ok(!src.includes('function instanceize') && !src.includes('function makeTree') && !src.includes('function scatter'));
  });

  test('rejects out_dir outside the base directory', async () => {
    await assert.rejects(() => orch.build({ prompt: 'a box', out_dir: '../../etc/x' }), /must be inside/);
  });
});

describe('single models', () => {
  for (const name of Object.keys(MODELS)) {
    test(`forge_model: ${name}`, async () => {
      const r = await orch.model({ model: name });
      assert.ok(r.ok, JSON.stringify(r.validation));
      assert.ok(r.source.includes('export function createModel'));
    });
  }
  test('unknown model gives a helpful error', async () => {
    await assert.rejects(() => orch.model({ model: 'dragon' }), /Available:/);
  });
});

describe('reviewer', () => {
  test('flags legacy and slow code and scores it', async () => {
    const code = `
      const renderer = new THREE.WebGLRenderer();
      renderer.setPixelRatio(window.devicePixelRatio);
      renderer.outputEncoding = THREE.sRGBEncoding;
      mesh.castShadow = true;
      function animate() {
        requestAnimationFrame(animate);
        const m = new THREE.Mesh(new THREE.BoxGeometry(), mat);
        renderer.render(scene, camera);
      }
      animate();`;
    const r = await orch.review({ code });
    const ids = r.findings.map((f) => f.id);
    for (const id of ['encoding-api', 'pixel-ratio-uncapped', 'shadows-not-enabled', 'alloc-in-loop', 'no-resize']) assert.ok(ids.includes(id), `missing ${id}`);
    assert.ok(r.score < 50);
  });
  test('generated output reviews clean of errors and warnings', async () => {
    const b = await orch.build({ prompt: 'a village', write_files: false });
    const r = await orch.review({ code: b.files['index.html'] });
    assert.deepEqual(r.findings.filter((f) => f.severity !== 'info'), []);
  });
  test('reports syntax errors with a line number', async () => {
    const r = await orch.review({ code: 'const a = 1;\nconst = ;' });
    assert.equal(r.findings[0].id, 'syntax');
    assert.equal(r.findings[0].line, 2);
  });
});
