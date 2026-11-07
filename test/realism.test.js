// Sculpting engine + realistic (skinned) models + style switch.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import * as H from '../src/library/helpers.js';
import { buildModel, measure } from '../src/core/sandbox.js';
import { Orchestrator } from '../src/core/orchestrator.js';

// eslint-disable-next-line no-new-func
const sculpt = new Function('THREE', `${H.sculpt.toString()}; return sculpt;`)(THREE);

describe('sculpt engine', () => {
  test('a sphere is meshed accurately with outward winding', () => {
    const g = sculpt([{ s: ['s', 0, 0, 0, 0.1] }], { cell: 0.01 });
    const p = g.attributes.position, n = g.attributes.normal, idx = g.index.array;
    let maxErr = 0;
    for (let i = 0; i < p.count; i++) maxErr = Math.max(maxErr, Math.abs(Math.hypot(p.getX(i), p.getY(i), p.getZ(i)) - 0.1));
    assert.ok(maxErr < 1e-5, `surface error ${maxErr}`);
    let agree = 0;
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), nn = new THREE.Vector3();
    for (let i = 0; i < idx.length; i += 3) {
      a.fromBufferAttribute(p, idx[i]); b.fromBufferAttribute(p, idx[i + 1]); c.fromBufferAttribute(p, idx[i + 2]);
      if (b.sub(a).cross(c.sub(a)).dot(nn.fromBufferAttribute(n, idx[i])) > 0) agree++;
    }
    assert.equal(agree, idx.length / 3, 'every face wound outward');
  });

  test('smooth union blends, subtraction carves, planes cut', () => {
    const blend = sculpt([{ s: ['s', -0.05, 0, 0, 0.06] }, { s: ['s', 0.05, 0, 0, 0.06], k: 0.04 }], { cell: 0.006 });
    const carved = sculpt([{ s: ['s', 0, 0, 0, 0.1] }, { s: ['s', 0, 0, 0.1, 0.05], op: 's' }], { cell: 0.008 });
    const cut = sculpt([{ g: [{ s: ['s', 0, 0, 0, 0.1] }, { s: ['p', 0, 1, 0, 0], op: 'i' }] }], { cell: 0.008 });
    const maxY = (g) => { let m = -1; for (let i = 0; i < g.attributes.position.count; i++) m = Math.max(m, g.attributes.position.getY(i)); return m; };
    const maxZ = (g) => { let m = -1; for (let i = 0; i < g.attributes.position.count; i++) m = Math.max(m, g.attributes.position.getZ(i)); return m; };
    let waist = 0; const bp = blend.attributes.position;
    for (let i = 0; i < bp.count; i++) if (Math.abs(bp.getX(i)) < 0.004) waist = Math.max(waist, bp.getY(i));
    assert.ok(waist > Math.sqrt(0.06 ** 2 - 0.05 ** 2) + 0.004, `smooth union fills the waist (${waist.toFixed(3)})`);
    assert.ok(maxZ(carved) < 0.089, 'subtraction removed the front cap (rim of the bite at z≈0.0875)');
    assert.ok(maxY(cut) < 0.005, 'plane removed the top half');
  });

  test('groups pass their bone to children (skin weights follow the right bone)', () => {
    const g = sculpt([{ s: ['s', 0, 0, 0, 0.05], bone: 1 }, { g: [{ s: ['s', 0.2, 0, 0, 0.05] }], bone: 3 }], { cell: 0.01 });
    const si = g.attributes.skinIndex, p = g.attributes.position;
    for (let i = 0; i < p.count; i++) assert.equal(si.getX(i), p.getX(i) > 0.1 ? 3 : 1);
  });
});

describe('realistic models', () => {
  test('humans are sculpted, skinned to a 17-bone skeleton, with feet on the ground', () => {
    const { obj } = buildModel('human', { height: 1.8, outfit: 'suit', hair: 'short' });
    const skinned = []; obj.traverse((o) => o.isSkinnedMesh && skinned.push(o));
    assert.ok(skinned.length >= 4, 'skin, hair, clothes, shoes');
    assert.equal(skinned[0].skeleton.bones.length, 17);
    const box = new THREE.Box3();
    for (const m of skinned) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox); }
    assert.ok(Math.abs(box.min.y) < 0.03, `feet at ${box.min.y}`);
    assert.ok(Math.abs(box.max.y - 1.8) < 0.08, `top at ${box.max.y}`);
  });

  test('rig poses deform the mesh (arm raised when waving)', () => {
    const { obj } = buildModel('human', { sex: 'female' });
    const skin = obj.children.find((o) => o.isSkinnedMesh);
    const hand = obj.getObjectByName('hdR');
    obj.userData.rig(0, 'idle'); obj.updateMatrixWorld(true);
    const low = new THREE.Vector3(); hand.getWorldPosition(low);
    obj.userData.rig(0.3, 'wave'); obj.updateMatrixWorld(true);
    const high = new THREE.Vector3(); hand.getWorldPosition(high);
    assert.ok(high.y > low.y + 0.5, `hand rose from ${low.y.toFixed(2)} to ${high.y.toFixed(2)}`);
    assert.ok(skin.skeleton.bones.every((b) => b.matrixWorld.elements.every(Number.isFinite)));
  });

  test('creatures are sculpted and skinned; wings fold back at rest', () => {
    const { obj } = buildModel('bird', { size: 0.8, body: 0x5a3a22 });
    obj.updateMatrixWorld(true);
    const mesh = obj.children.find((o) => o.isSkinnedMesh);
    const pos = mesh.geometry.attributes.position;
    let tip = 0; for (let i = 0; i < pos.count; i++) if (pos.getX(i) > pos.getX(tip)) tip = i;
    const v = new THREE.Vector3().fromBufferAttribute(pos, tip);
    mesh.applyBoneTransform(tip, v);
    assert.ok(v.z < 0, `folded wing tip should point backwards (z=${v.z.toFixed(2)})`);
  });

  test('props are sculpted too (rocks, trees)', () => {
    for (const [m, p] of [['rock', {}], ['tree', { style: 'round' }], ['tree', { style: 'pine' }]]) {
      const s = measure(buildModel(m, p).obj);
      assert.ok(s.finite && s.triangles > 3000, `${m}: ${s.triangles} tris`);
    }
  });
});

describe('style switch', () => {
  const orch = new Orchestrator();
  test('"low poly" / "cartoon" requests use the stylized factories', async () => {
    const r = await orch.build({ prompt: 'a cartoon knight riding a horse, low poly', write_files: false });
    assert.equal(r.spec.style, 'stylized');
    assert.ok(r.ok);
    assert.ok(!r.files['scene.js'].includes('function sculpt('), 'stylized scenes do not ship the sculptor');
  });
  test('default is realistic and ships the sculptor + skinning', async () => {
    const r = await orch.build({ prompt: 'a woman waving', write_files: false });
    assert.equal(r.spec.style, 'realistic');
    assert.ok(r.files['scene.js'].includes('function sculpt(') && r.files['scene.js'].includes('SkinnedMesh'));
    assert.ok(r.files['index.html'].includes('GTAOPass'));
  });
});
