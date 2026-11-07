// Character + creature agents: planning quality, every archetype/species, rigs, relations.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Orchestrator } from '../src/core/orchestrator.js';
import { ARCHETYPES, HAIR_COLORS } from '../src/library/characters.js';
import { SPECIES } from '../src/library/creatures.js';
import { COLORS } from '../src/library/materials.js';
import { buildModel, measure } from '../src/core/sandbox.js';

const orch = new Orchestrator();
const plan = async (prompt) => (await orch.plan({ prompt })).spec;

describe('character agent', () => {
  test('reads a detailed description like a character artist', async () => {
    const spec = await plan('a tall old woman with long grey hair, blue eyes and glasses in a green dress waving');
    const h = spec.objects[0];
    assert.equal(h.model, 'human');
    const p = h.params;
    assert.equal(p.sex, 'female');
    assert.equal(p.age, 'elder');
    assert.equal(p.hair, 'long');
    assert.equal(p.hairColor, HAIR_COLORS.grey);
    assert.equal(p.glasses, 'glasses');
    assert.equal(p.outfit, 'dress');
    assert.equal(p.top, COLORS.green);
    assert.equal(h.animation.type, 'wave');
    assert.ok(p.height > 1.6, 'tall');
    assert.match(h.sheet, /elder female/);
  });

  test('anatomy follows real proportions: children have bigger heads, adults ~7.5 heads', async () => {
    const kid = (await plan('a little boy')).objects[0].params;
    const man = (await plan('a man')).objects[0].params;
    assert.ok(kid.headUnits < 6 && kid.height < 1.4);
    assert.ok(man.headUnits >= 7 && man.height > 1.65);
  });

  test('every archetype plans and builds with its signature gear', async () => {
    for (const a of Object.keys(ARCHETYPES)) {
      const o = { id: 'x', model: 'human', count: 1, params: { archetype: a }, description: a, material: {}, scale: 1 };
      await orch.agents.character.plan(o, { trace: [], warn() {}, note() {} });
      const { obj } = buildModel('human', o.params);
      const s = measure(obj);
      assert.ok(s.finite && s.drawCalls <= 40, `${a}: ${JSON.stringify(s)}`);
      if (ARCHETYPES[a].hat) assert.equal(o.params.hat, ARCHETYPES[a].hat, `${a} hat`);
      if (ARCHETYPES[a].outfit) assert.equal(o.params.outfit, ARCHETYPES[a].outfit, `${a} outfit`);
    }
  });

  test('crowds vary per copy and use a lighter mesh', async () => {
    const h = (await plan('a crowd of 40 people')).objects.find((o) => o.model === 'human');
    assert.ok(h.params.vary && h.params.varySkin && h.params.varyClothes);
    assert.equal(h.params.lod, 'low');
    const a = measure(buildModel('human', { ...h.params, variant: 0 }).obj);
    const b = measure(buildModel('human', { ...h.params, lod: 'high', variant: 0 }).obj);
    assert.ok(a.triangles < b.triangles * 0.6, `lod ${a.triangles} vs ${b.triangles}`);
  });

  test('riders sit on their mount; companions walk beside their person', async () => {
    const r = await orch.build({ prompt: 'a knight riding a white horse and a girl walking her dog', write_files: false });
    assert.ok(r.ok, JSON.stringify(r.validation.runtime));
    const knight = r.spec.objects.find((o) => o.params.archetype === 'knight');
    const dog = r.spec.objects.find((o) => o.params.species === 'dog');
    assert.equal(knight.attach.kind, 'rider');
    assert.equal(knight.params.pose, 'ride');
    assert.equal(dog.attach.kind, 'companion');
    assert.ok(r.files['scene.js'].includes('userData.saddle'));
  });

  test('round-trips: building the planned spec again gives the same people', async () => {
    const a = await orch.build({ prompt: 'a businessman with glasses and a chef', write_files: false });
    const { compactSpec } = await import('../src/core/orchestrator.js');
    const b = await orch.build({ spec: compactSpec(a.spec), write_files: false });
    const pick = (r) => r.spec.objects.map((o) => [o.params.skin, o.params.hair, o.params.top, o.params.height]);
    assert.deepEqual(pick(b), pick(a));
  });
});

describe('creature agent', () => {
  test('every species plans, builds and runs every gait', async () => {
    for (const sp of Object.keys(SPECIES)) {
      const r = await orch.model({ model: sp });
      assert.ok(r.ok, `${sp}: ${JSON.stringify(r.validation.runtime)}`);
      assert.ok(r.source.includes('userData.rig'), `${sp} is rigged`);
    }
  });

  test('reads coat colours, patterns, age and anatomy modifiers', async () => {
    const o = (await plan('a black and white spotted baby horse with wings')).objects[0];
    assert.equal(o.params.species, 'horse');
    assert.equal(o.params.coat, COLORS.black);
    assert.equal(o.params.accent, COLORS.white);
    assert.ok(o.params.spots > 0 && o.params.wings);
    assert.ok(o.scale < 1, 'baby');
  });

  test('picks a gait that fits the body plan', async () => {
    const s = await plan('a galloping horse, a flying eagle, a shark, a penguin flying and a slithering snake');
    const by = Object.fromEntries(s.objects.map((o) => [o.params.species, o.animation?.type]));
    assert.deepEqual(by, { horse: 'run', eagle: 'fly', shark: 'swim', penguin: 'walk', snake: 'slither' });
  });

  test('multi-word species and plural aliases resolve', async () => {
    const s = await plan('two polar bears and 5 mice');
    assert.deepEqual(s.objects.map((o) => [o.params.species, o.count]), [['polar bear', 2], ['mouse', 5]]);
  });

  test('themes populate with animals: farm, savanna, reef', async () => {
    for (const [prompt, sp] of [['a farm', 'cow'], ['a savanna', 'elephant'], ['a coral reef', 'clownfish']]) {
      const s = await plan(prompt);
      assert.ok(s.objects.some((o) => o.params.species === sp), `${prompt} → ${sp}`);
    }
  });
});

test('character scenes stay within budget and validate', async () => {
  for (const prompt of ['a park with 20 people walking and 2 dogs', 'a crowd of 60 people', 'a medieval village with a knight on a horse', 'a graveyard at night with zombies walking']) {
    const r = await orch.build({ prompt, write_files: false });
    assert.ok(r.ok, `${prompt}: ${JSON.stringify(r.validation.runtime)}`);
  }
});
