// Description accuracy and natural look: what the user writes must show up in the model, and what
// cannot be modelled is reported instead of silently dropped.
import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Orchestrator } from '../src/core/orchestrator.js';
import { buildModel } from '../src/core/sandbox.js';
import { HAIR_COLORS } from '../src/library/characters.js';
import { BREEDS } from '../src/library/creatures.js';

let dir, orch;
before(async () => { dir = await mkdtemp(path.join(tmpdir(), 'forge-fid-')); orch = new Orchestrator({ baseDir: dir }); });
after(() => rm(dir, { recursive: true, force: true }));

const person = async (d) => (await orch.character({ description: d, write_files: false, glb: false })).subject;

describe('people follow the description', () => {
  test('hair colour before any hairstyle word', async () => {
    const p = (await person('a girl with a blonde ponytail')).params;
    assert.equal(p.hair, 'ponytail'); assert.equal(p.hairColor, HAIR_COLORS.blonde);
    assert.equal((await person('a woman with red braids')).params.hair, 'braid');
    assert.equal((await person('a young woman with long dark hair')).params.hairColor, HAIR_COLORS.dark);
  });
  test('ages, heads and beards', async () => {
    const teen = (await person('a teenage boy in a black t-shirt')).params;
    assert.equal(teen.age, 'teen');
    assert.equal((await person('a tall man with a shaved head')).params.hair, 'bald');
    const b = (await person('a man with a brown beard')).params;
    assert.equal(b.beard, 'full'); assert.equal(b.hairColor, HAIR_COLORS.brown);
    assert.equal((await person('an old man with a white mustache')).params.hairColor, HAIR_COLORS.white);
  });
  test('garments keep their own colours; nothing unrequested is added', async () => {
    const p = (await person('a chubby boy in a green hoodie and jeans')).params;
    assert.notEqual(p.bottom, p.top, 'the hoodie colour must not bleed onto the jeans');
    const plaid = (await person('a man wearing a red plaid shirt')).params;
    assert.equal(plaid.print, 'plaid');
    assert.equal((await person('an old woman in a blue dress')).params.glasses, 'none');
    const doc = (await person('a doctor in a white lab coat with a stethoscope')).params;
    assert.equal(doc.outfit, 'labcoat'); assert.equal(doc.stethoscope, true);
    assert.equal((await person('an old man with a cane')).params.prop, 'cane');
  });
  test('what cannot be modelled is reported', async () => {
    const s = await person('a woman with a tattoo and a scarf');
    assert.ok(s.fidelity.ignored.includes('tattoo') && s.fidelity.ignored.includes('scarf'), JSON.stringify(s.fidelity));
    assert.equal((await person('a woman with long red hair in a yellow dress')).fidelity.ignored.length, 0);
  });
});

describe('natural faces and hair', () => {
  test('eyelids, lashes and brows are cards the critic does not count as holes', () => {
    const { obj } = buildModel('human', { sex: 'female', hair: 'long' });
    let cards = 0; obj.traverse((o) => { if (o.userData.card) cards++; });
    assert.ok(cards >= 6, `eyelids + lashes + brows, got ${cards}`);
  });
  test('ponytail, bun and braids add ties; freckles change the face colours', () => {
    const ties = (hair) => { let n = 0; buildModel('human', { sex: 'female', hair }).obj.traverse((o) => { if (o.isMesh && o.geometry.type === 'TorusGeometry') n++; }); return n; };
    assert.equal(ties('ponytail'), 1); assert.equal(ties('pigtails'), 2); assert.equal(ties('bun'), 1);
    const col = (freckles) => { let sum = 0; buildModel('human', { sex: 'female', freckles }).obj.traverse((o) => { if (o.isSkinnedMesh && !sum) { const c = o.geometry.attributes.color; for (let i = 0; i < c.count; i++) sum += c.getX(i); } }); return sum; };
    assert.ok(col(true) < col(false), 'freckles darken some face vertices');
  });
});

describe('animals follow the description', () => {
  test('breeds are recognised with their colouring; golden is a colour, not metal', async () => {
    const r = await orch.character({ description: 'a golden retriever', write_files: false, glb: false });
    assert.equal(r.subject.params.species, 'dog');
    assert.equal(r.subject.params.coat, BREEDS['golden retriever'].c.coat);
    assert.ok(!r.subject.material.preset, 'not a gold statue');
    const c = await orch.character({ description: 'a corgi', write_files: false, glb: false });
    assert.ok(c.subject.params.legLen < 0.3, `short legs, got ${c.subject.params.legLen}`);
  });
});
