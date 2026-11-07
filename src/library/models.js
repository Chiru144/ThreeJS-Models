// Procedural model library. Every factory has the signature
//   makeX(THREE, M, p, main) -> THREE.Object3D
// M(key, props, type) is a cached material factory, p the params, `main` the
// resolved primary material (or undefined). Models sit on y = 0, centred on x/z.
// Factories are real functions so they are syntax-checked and testable; codegen
// copies them into the output with Function#toString.
/* eslint-disable no-undef */
import { HUMAN_FACTORY, ARCHETYPES, OUTFITS, HATS, PROPS, HAIR_STYLES, AGES, BUILDS } from './characters.js';
import { CREATURE_FACTORIES, SPECIES } from './creatures.js';
import { resolveColor } from './materials.js';

function makeBox(THREE, M, p, main) {
  const s = p.size ?? 1;
  const m = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), main || M('default', { color: 0x8899aa }));
  m.position.y = s / 2;
  return m;
}
function makeSphere(THREE, M, p, main) {
  const r = p.radius ?? 0.75, d = p.detail ?? 32;
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, d, Math.round(d * 0.75)), main || M('default', { color: 0x8899aa }));
  m.position.y = r;
  return m;
}
function makeCylinder(THREE, M, p, main) {
  const r = p.radius ?? 0.5, h = p.height ?? 1.5;
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, p.detail ?? 32), main || M('default', { color: 0x8899aa }));
  m.position.y = h / 2;
  return m;
}
function makeCone(THREE, M, p, main) {
  const r = p.radius ?? 0.6, h = p.height ?? 1.5;
  const m = new THREE.Mesh(new THREE.ConeGeometry(r, h, p.detail ?? 32), main || M('default', { color: 0x8899aa }));
  m.position.y = h / 2;
  return m;
}
function makeTorus(THREE, M, p, main) {
  const r = p.radius ?? 0.7, t = p.tube ?? 0.25;
  const m = new THREE.Mesh(new THREE.TorusGeometry(r, t, 24, 64), main || M('default', { color: 0x8899aa }));
  m.position.y = r + t;
  return m;
}
function makeTorusKnot(THREE, M, p, main) {
  const r = p.radius ?? 0.7, t = p.tube ?? 0.22;
  const m = new THREE.Mesh(new THREE.TorusKnotGeometry(r, t, 160, 24, p.p ?? 2, p.q ?? 3), main || M('default', { color: 0x8899aa }));
  m.position.y = r + t * 3;
  return m;
}
function makeCapsule(THREE, M, p, main) {
  const r = p.radius ?? 0.4, l = p.length ?? 1;
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, l, 8, 24), main || M('default', { color: 0x8899aa }));
  m.position.y = r + l / 2;
  return m;
}
function makeCrystal(THREE, M, p, main) {
  const h = p.height ?? 1.2;
  const m = new THREE.Mesh(new THREE.OctahedronGeometry(h / 2, 0),
    main || M('crystal', { color: 0x8fd3ff, roughness: 0.05, transmission: 0.9, thickness: 0.6, ior: 1.6 }, 'MeshPhysicalMaterial'));
  m.scale.set(0.45, 1, 0.45);
  m.position.y = h / 2;
  return m;
}
function makeTree(THREE, M, p, main) {
  const h = p.height ?? 3, g = new THREE.Group();
  const trunkH = h * 0.35;
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.035, h * 0.055, trunkH, 8), M('bark', { color: 0x6b4423, roughness: 0.95 }));
  trunk.position.y = trunkH / 2;
  g.add(trunk);
  const leaf = main || M('leaf', { color: 0x2f7d32, roughness: 0.85, flatShading: true });
  if ((p.style ?? 'pine') === 'round') {
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(h * 0.32, 1), leaf);
    crown.position.y = trunkH + h * 0.25;
    g.add(crown);
  } else {
    for (let i = 0; i < 3; i++) {
      const r = h * (0.3 - i * 0.07), ch = h * (0.4 - i * 0.06);
      const c = new THREE.Mesh(new THREE.ConeGeometry(r, ch, 10), leaf);
      c.position.y = trunkH + i * h * 0.18 + ch / 2 - h * 0.05;
      g.add(c);
    }
  }
  return g;
}
function makeRock(THREE, M, p, main) {
  const s = p.size ?? 0.8, seed = p.seed ?? 7;
  const geo = new THREE.IcosahedronGeometry(s, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    // hash of the vertex position, so shared vertices move together (no cracks)
    const h = Math.sin(Math.round(x * 1e3) * 12.9898 + Math.round(y * 1e3) * 78.233 + Math.round(z * 1e3) * 37.719 + seed) * 43758.5453;
    const k = 0.75 + (h - Math.floor(h)) * 0.45;
    pos.setXYZ(i, x * k, y * k * 0.65, z * k);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, main || M('stone', { color: 0x8a8580, roughness: 0.95, flatShading: true }));
  m.position.y = s * 0.3;
  return m;
}
function makeMushroom(THREE, M, p, main) {
  const h = p.height ?? 0.6, g = new THREE.Group();
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.1, h * 0.14, h * 0.7, 10), M('stem', { color: 0xf3ead7, roughness: 0.8 }));
  stem.position.y = h * 0.35;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(h * 0.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), main || M('cap', { color: 0xd23b2f, roughness: 0.6 }));
  cap.position.y = h * 0.65;
  g.add(stem, cap);
  return g;
}
function makeHouse(THREE, M, p, main) {
  const w = p.width ?? 4, d = p.depth ?? 4, h = p.height ?? 2.6, g = new THREE.Group();
  const walls = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), main || M('walls', { color: 0xe8d8c3, roughness: 0.9 }));
  walls.position.y = h / 2;
  const r = (w / Math.SQRT2) * 1.12;
  const roof = new THREE.Mesh(new THREE.ConeGeometry(r, h * 0.7, 4), M('roof', { color: 0x9c3b2a, roughness: 0.8, flatShading: true }));
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = d / w;
  roof.position.y = h + h * 0.35;
  const door = new THREE.Mesh(new THREE.BoxGeometry(w * 0.2, h * 0.5, 0.08), M('door', { color: 0x5a3a22, roughness: 0.7 }));
  door.position.set(0, h * 0.25, d / 2 + 0.03);
  const winMat = M('window', { color: 0xbfe6ff, emissive: 0xffd27a, emissiveIntensity: p.lit ? 1.5 : 0.05, roughness: 0.1 });
  g.add(walls, roof, door);
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.BoxGeometry(w * 0.18, h * 0.22, 0.06), winMat);
    win.position.set(sx * w * 0.3, h * 0.6, d / 2 + 0.03);
    g.add(win);
  }
  return g;
}
function makeCar(THREE, M, p, main) {
  const L = p.length ?? 4, g = new THREE.Group();
  const paint = main || M('carpaint', { color: 0xc0392b, metalness: 0.6, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }, 'MeshPhysicalMaterial');
  const body = new THREE.Mesh(new THREE.BoxGeometry(L, L * 0.15, L * 0.45), paint);
  body.position.y = L * 0.16;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(L * 0.5, L * 0.13, L * 0.4), M('carglass', { color: 0x1b2430, metalness: 0.2, roughness: 0.1 }));
  cabin.position.set(-L * 0.05, L * 0.3, 0);
  g.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(L * 0.09, L * 0.09, L * 0.08, 20);
  wheelGeo.rotateX(Math.PI / 2);
  const tire = M('tire', { color: 0x1a1a1a, roughness: 0.9 });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wheelGeo, tire);
    w.position.set(sx * L * 0.32, L * 0.09, sz * L * 0.23);
    g.add(w);
  }
  return g;
}
function makeRobot(THREE, M, p, main) {
  const h = p.height ?? 2, u = h / 10, g = new THREE.Group();
  const shell = main || M('robot', { color: 0xb8c4d0, metalness: 0.8, roughness: 0.3 });
  const joint = M('joint', { color: 0x30343a, metalness: 0.5, roughness: 0.5 });
  const eye = M('eye', { color: 0x000000, emissive: 0x33ddff, emissiveIntensity: 3 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(u * 1.2, u * 4, u * 1.2), joint, s * u * 1.1, u * 2, 0);
  add(new THREE.BoxGeometry(u * 4, u * 3.4, u * 2.4), shell, 0, u * 5.7, 0);
  for (const s of [-1, 1]) add(new THREE.BoxGeometry(u * 0.9, u * 3, u * 0.9), joint, s * u * 2.6, u * 5.6, 0);
  add(new THREE.BoxGeometry(u * 2.4, u * 1.8, u * 2), shell, 0, u * 8.4, 0);
  for (const s of [-1, 1]) add(new THREE.SphereGeometry(u * 0.25, 12, 8), eye, s * u * 0.55, u * 8.6, u * 1.01);
  return g;
}
function makePlanet(THREE, M, p, main) {
  const r = p.radius ?? 2, g = new THREE.Group();
  const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 64, 48), main || M('planet', { color: 0xd9a066, roughness: 0.9 }));
  g.add(ball);
  if (p.rings) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.4, r * 2.2, 96),
      M('ring', { color: 0xe8d5b0, roughness: 0.8, side: THREE.DoubleSide, transparent: true, opacity: 0.75 }));
    ring.rotation.x = -Math.PI / 2.4;
    g.add(ring);
  }
  g.position.y = r;
  return g;
}
function makeStars(THREE, M, p) {
  const n = p.count ?? 2000, R = p.radius ?? 300, r = rng(p.seed ?? 99);
  const pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, a = r() * Math.PI * 2, s = Math.sqrt(1 - u * u), d = R * (0.6 + r() * 0.4);
    pos.set([Math.cos(a) * s * d, u * d, Math.sin(a) * s * d], i * 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.5, sizeAttenuation: false, fog: false }));
  pts.userData.noShadow = true;
  return pts;
}
function makeVase(THREE, M, p, main) {
  const h = p.height ?? 1.4, pts = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    pts.push(new THREE.Vector2(h * (0.18 + 0.16 * Math.sin(t * Math.PI * 1.15 + 0.2) - 0.06 * t), t * h));
  }
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts, 48),
    main || M('ceramic', { color: 0x2f6f8f, roughness: 0.25, clearcoat: 0.8, side: THREE.DoubleSide }, 'MeshPhysicalMaterial'));
  return m;
}
function makeTable(THREE, M, p, main) {
  const w = p.width ?? 2, d = p.depth ?? 1, h = p.height ?? 0.8, g = new THREE.Group();
  const wood = main || M('wood', { color: 0x8b5a2b, roughness: 0.75 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(w, 0.08, d), wood);
  top.position.y = h - 0.04;
  g.add(top);
  const legGeo = new THREE.BoxGeometry(0.08, h - 0.08, 0.08);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(sx * (w / 2 - 0.1), (h - 0.08) / 2, sz * (d / 2 - 0.1));
    g.add(leg);
  }
  return g;
}
function makeChair(THREE, M, p, main) {
  const s = p.size ?? 0.5, g = new THREE.Group();
  const wood = main || M('wood', { color: 0x8b5a2b, roughness: 0.75 });
  const seat = new THREE.Mesh(new THREE.BoxGeometry(s, 0.06, s), wood);
  seat.position.y = 0.45;
  const back = new THREE.Mesh(new THREE.BoxGeometry(s, 0.5, 0.05), wood);
  back.position.set(0, 0.73, -s / 2 + 0.025);
  g.add(seat, back);
  const legGeo = new THREE.BoxGeometry(0.05, 0.45, 0.05);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, wood);
    leg.position.set(sx * (s / 2 - 0.04), 0.225, sz * (s / 2 - 0.04));
    g.add(leg);
  }
  return g;
}
function makeLamp(THREE, M, p, main) {
  const h = p.height ?? 3.5, g = new THREE.Group();
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, h, 10), main || M('iron', { color: 0x2b2b30, metalness: 0.8, roughness: 0.4 }));
  pole.position.y = h / 2;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12), M('bulb', { color: 0xffffff, emissive: 0xffd28a, emissiveIntensity: 4 }));
  bulb.position.y = h + 0.1;
  bulb.userData.noShadow = true;
  g.add(pole, bulb);
  if (p.light !== false) {
    const l = new THREE.PointLight(0xffc979, p.intensity ?? 6, h * 4, 2);
    l.position.y = h;
    g.add(l);
  }
  return g;
}
function makeWater(THREE, M, p, main) {
  const s = p.size ?? 20;
  const geo = new THREE.CircleGeometry(s / 2, 64);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, main || M('water', { color: 0x2a7fbf, roughness: 0.08, metalness: 0.1, transmission: 0.5, thickness: 1 }, 'MeshPhysicalMaterial'));
  m.position.y = 0.02;
  m.userData.noCast = true;
  return m;
}
function makeGround(THREE, M, p, main) {
  const s = p.size ?? 60;
  const geo = new THREE.PlaneGeometry(s, s);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, main || M('ground', { color: 0x6c8f4e, roughness: 1 }));
  m.userData.noCast = true;
  return m;
}
function makeTerrain(THREE, M, p, main) {
  const s = p.size ?? 80, seg = p.segments ?? 96;
  const geo = new THREE.PlaneGeometry(s, s, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, main || M('grass', { color: 0x5f8f45, roughness: 1, flatShading: true }));
  m.userData.noCast = true;
  return m;
}

const P = (def, min, max) => ({ default: def, min, max });

// name -> metadata. footprint = approx radius on the ground plane (scale 1),
// height = approx height, natural = gets random yaw/scale when scattered.
export const MODELS = {
  box: { fn: makeBox, kind: 'primitive', footprint: 0.7, height: 1, params: { size: P(1, 0.1, 50) }, aliases: ['cube', 'block', 'crate'] },
  sphere: { fn: makeSphere, kind: 'primitive', footprint: 0.8, height: 1.5, params: { radius: P(0.75, 0.05, 50), detail: P(32, 8, 128) }, aliases: ['ball', 'orb'] },
  cylinder: { fn: makeCylinder, kind: 'primitive', footprint: 0.6, height: 1.5, params: { radius: P(0.5, 0.05, 50), height: P(1.5, 0.1, 100) }, aliases: ['pillar', 'column'] },
  cone: { fn: makeCone, kind: 'primitive', footprint: 0.6, height: 1.5, params: { radius: P(0.6, 0.05, 50), height: P(1.5, 0.1, 100) }, aliases: ['pyramid'] },
  torus: { fn: makeTorus, kind: 'primitive', footprint: 1, height: 1.9, params: { radius: P(0.7, 0.1, 50), tube: P(0.25, 0.02, 10) }, aliases: ['donut'] },
  torusKnot: { fn: makeTorusKnot, kind: 'primitive', footprint: 1, height: 2.1, params: { radius: P(0.7, 0.1, 50), tube: P(0.22, 0.02, 10), p: P(2, 1, 9), q: P(3, 1, 9) }, aliases: ['knot', 'torusknot', 'torus knot'] },
  capsule: { fn: makeCapsule, kind: 'primitive', footprint: 0.5, height: 1.8, params: { radius: P(0.4, 0.05, 20), length: P(1, 0, 50) }, aliases: ['pill'] },
  crystal: { fn: makeCrystal, kind: 'procedural', footprint: 0.4, height: 1.2, natural: true, params: { height: P(1.2, 0.1, 20) }, aliases: ['gem', 'diamond', 'shard'] },
  tree: { fn: makeTree, kind: 'procedural', footprint: 1, height: 3, natural: true, params: { height: P(3, 0.5, 30), style: { default: 'pine', enum: ['pine', 'round'] } }, aliases: ['pine', 'oak', 'forest tree'], aliasParams: { oak: { style: 'round' } } },
  rock: { fn: makeRock, kind: 'procedural', footprint: 0.8, height: 0.6, natural: true, params: { size: P(0.8, 0.1, 20), seed: P(7, 0, 1e6) }, aliases: ['stone', 'boulder', 'asteroid'] },
  mushroom: { fn: makeMushroom, kind: 'procedural', footprint: 0.3, height: 0.6, natural: true, params: { height: P(0.6, 0.1, 10) }, aliases: ['toadstool'] },
  house: { fn: makeHouse, kind: 'procedural', footprint: 3, height: 4.5, params: { width: P(4, 1, 30), depth: P(4, 1, 30), height: P(2.6, 1, 20), lit: { default: false } }, aliases: ['home', 'cottage', 'cabin', 'building', 'hut'] },
  car: { fn: makeCar, kind: 'procedural', footprint: 2.2, height: 1.4, params: { length: P(4, 1, 20) }, aliases: ['vehicle', 'automobile'] },
  robot: { fn: makeRobot, kind: 'procedural', footprint: 0.7, height: 2, params: { height: P(2, 0.3, 20) }, aliases: ['android', 'mech', 'bot'] },
  planet: { fn: makePlanet, kind: 'procedural', footprint: 2.5, height: 4, params: { radius: P(2, 0.2, 100), rings: { default: false } }, aliases: ['moon', 'world', 'saturn'], aliasParams: { saturn: { rings: true } } },
  stars: { fn: makeStars, kind: 'backdrop', footprint: 0, height: 0, params: { count: P(2000, 10, 50000), radius: P(300, 10, 5000), seed: P(99, 0, 1e6) }, aliases: ['starfield', 'star', 'starry sky'] },
  vase: { fn: makeVase, kind: 'parametric', footprint: 0.4, height: 1.4, params: { height: P(1.4, 0.1, 20) }, aliases: ['pot', 'urn'] },
  table: { fn: makeTable, kind: 'procedural', footprint: 1.1, height: 0.8, params: { width: P(2, 0.3, 10), depth: P(1, 0.3, 10), height: P(0.8, 0.2, 3) }, aliases: ['desk'] },
  chair: { fn: makeChair, kind: 'procedural', footprint: 0.4, height: 1, params: { size: P(0.5, 0.2, 3) }, aliases: ['seat', 'stool'] },
  lamp: { fn: makeLamp, kind: 'procedural', footprint: 0.3, height: 3.6, params: { height: P(3.5, 0.5, 20), light: { default: true }, intensity: P(6, 0, 1000) }, aliases: ['streetlight', 'street lamp', 'lantern', 'lamppost'] },
  water: { fn: makeWater, kind: 'surface', footprint: 0, height: 0, params: { size: P(20, 1, 1000) }, aliases: ['lake', 'pond', 'ocean', 'sea', 'pool'] },
  ground: { fn: makeGround, kind: 'surface', footprint: 0, height: 0, params: { size: P(60, 1, 5000) }, aliases: ['floor', 'plane'] },
  terrain: { fn: makeTerrain, kind: 'surface', footprint: 0, height: 0, params: { size: P(80, 4, 2000), segments: P(96, 4, 512), amp: P(1.5, 0, 100) }, aliases: ['hills', 'landscape', 'mountains', 'hill'] },
  ...characterModels(),
  ...creatureModels(),
};

function characterModels() {
  const C = (def) => ({ default: def, color: true });
  const E = (def, list) => ({ default: def, enum: list });
  const aliases = [...Object.keys(ARCHETYPES), 'people', 'persons', 'men', 'women', 'children', 'kids', 'human', 'character', 'figure', 'lady', 'guy', 'gentleman', 'villager', 'villagers', 'warrior', 'mage', 'sorcerer', 'sorceress', 'toddler', 'teenager', 'grandmother', 'grandfather', 'pedestrian', 'tourist', 'citizen', 'npc'];
  const map = { people: 'person', persons: 'person', men: 'man', women: 'woman', children: 'child', kids: 'child', human: 'person', character: 'person', figure: 'person', lady: 'woman', guy: 'man', gentleman: 'businessman', villager: 'farmer', villagers: 'farmer', warrior: 'soldier', mage: 'wizard', sorcerer: 'wizard', sorceress: 'witch', toddler: 'baby', teenager: 'teen', grandmother: 'grandma', grandfather: 'grandpa', pedestrian: 'person', tourist: 'person', citizen: 'person', npc: 'person' };
  return {
    human: {
      fn: HUMAN_FACTORY, kind: 'character', footprint: 0.4, height: 1.75, natural: true, variants: true, rigged: true,
      size: (p) => ({ footprint: 0.35 * (p.height ?? 1.74) / 1.74 * (p.girth ?? 1) + (p.prop === 'swordshield' || p.prop === 'shield' ? 0.2 : 0), height: p.height ?? 1.74 }),
      params: {
        archetype: E('person', Object.keys(ARCHETYPES)), age: E('adult', Object.keys(AGES)), sex: E('neutral', ['male', 'female', 'neutral']), build: E('average', Object.keys(BUILDS)),
        height: P(1.74, 0.5, 3), headUnits: P(7.5, 3.5, 9), legRatio: P(0.5, 0.36, 0.58), girth: P(1, 0.7, 1.7), shoulders: P(1, 0.7, 1.5),
        skin: C(0xc68e6a), hair: E('short', HAIR_STYLES), hairColor: C(0x2e1d12), eyeColor: C(0x5a3418), beard: E('none', ['none', 'stubble', 'mustache', 'goatee', 'full']),
        glasses: E('none', ['none', 'glasses', 'sunglasses']), ears: E('round', ['round', 'pointy']), earScale: P(1, 0.5, 3), noseScale: P(1, 0.5, 3), eyeScale: P(1, 0.5, 2), tusks: { default: false },
        outfit: E('casual', OUTFITS), top: C(0x2f4f7f), bottom: C(0x2b3a55), shoes: C(0x2a2420), accent: C(undefined), shorts: { default: false }, skirt: { default: false },
        hat: E('none', HATS), hatColor: C(undefined), prop: E('none', PROPS), cape: C(undefined), pose: E('normal', ['normal', 'zombie', 'ride']), lod: E('high', ['high', 'low']),
        vary: { default: false }, varySex: { default: false }, varySkin: { default: false }, varyHair: { default: false }, varyClothes: { default: false },
      },
      aliases,
      aliasParams: Object.fromEntries(aliases.map((a) => [a, { archetype: map[a] ?? a }])),
    },
  };
}

function creatureModels() {
  const plans = {};
  for (const [name, sp] of Object.entries(SPECIES)) (plans[sp.plan] ||= []).push(name);
  const extra = { quadruped: { kitten: 'cat', kitty: 'cat', bunny: 'rabbit', hare: 'rabbit', stag: 'deer', reindeer: 'deer', doe: 'deer', lamb: 'sheep', cattle: 'cow', calf: 'cow', ox: 'bull', foal: 'pony', mare: 'horse', stallion: 'horse', cub: 'bear', dino: 'dinosaur', brontosaurus: 'dinosaur', piglet: 'pig', hound: 'dog', wolves: 'wolf', mice: 'mouse', 'polar bears': 'polar bear' },
    bird: { hen: 'chicken', rooster: 'chicken', chick: 'chicken', seagull: 'bird', gull: 'bird', pigeon: 'bird', dove: 'bird', hawk: 'eagle', falcon: 'eagle', raven: 'crow', geese: 'duck', goose: 'duck' },
    fish: { shark: 'shark', orca: 'whale' },
    serpent: { serpent: 'snake', viper: 'snake' },
    arthropod: { bug: 'ladybug', insect: 'beetle', tarantula: 'giant spider', lobster: 'crab' } };
  const out = {};
  for (const [plan, names] of Object.entries(plans)) {
    // union of every preset key for this body plan -> param schema
    const params = { species: { default: names[0], enum: names }, vary: { default: false }, size: P(1, 0.01, 30), saddle: { default: false } };
    // Defaults come from the plan's default species; optional features (wings, horns,
    // spots…) that species lacks default to undefined = absent.
    const def = SPECIES[names[0]];
    for (const n of names) for (const [k, v] of Object.entries(SPECIES[n])) {
      if (k === 'plan' || params[k]) continue;
      const d = def[k];
      if (typeof v === 'boolean') params[k] = { default: d ?? false };
      else if (typeof v === 'string') params[k] = { default: d, enum: [...new Set(names.map((x) => SPECIES[x][k]).filter((x) => typeof x === 'string'))] };
      else if (/^(coat|belly|accent|hornColor|nose|eye|headColor|tailTip|body|wing|head|beak|legs|fin|spotColor|stripeColor)$/.test(k)) params[k] = { default: d, color: true };
      else params[k] = { default: d, min: -5, max: 100 };
    }
    const aliases = [...names, ...Object.keys(extra[plan] || {})];
    const presetFor = (a) => SPECIES[a] ? a : extra[plan][a];
    out[plan] = {
      fn: CREATURE_FACTORIES[plan], kind: 'creature', footprint: 0.6, height: 0.8, natural: true, variants: true, rigged: true,
      size: (p) => creatureSize(plan, p),
      params, aliases,
      aliasParams: Object.fromEntries(aliases.map((a) => [a, { species: presetFor(a) }])),
    };
  }
  return out;
}

function creatureSize(plan, p) {
  if (plan === 'quadruped') {
    const e = p.neckAngle ?? 0.8, nl = p.neckLen ?? 0.2;
    return { footprint: Math.max((p.bodyLen ?? 0.8) / 2 + nl * Math.cos(e) + (p.headLen ?? 0.25) * 0.6, (p.wingSpan ?? 0) * 0.8, (p.bodyW ?? 0.3)), height: (p.legLen ?? 0.4) + (p.bodyH ?? 0.3) + nl * Math.sin(e) + (p.headH ?? 0.15) };
  }
  if (plan === 'bird') return { footprint: (p.size ?? 0.2) * 0.7, height: (p.size ?? 0.2) * (1 + 0.35 * (p.legLen ?? 1) + (p.upright ?? 0) * 0.5) };
  if (plan === 'fish') return { footprint: (p.length ?? 0.4) * 0.55, height: (p.length ?? 0.4) * 0.45 };
  if (plan === 'serpent') return { footprint: (p.length ?? 1.6) * 0.5, height: (p.radius ?? 0.04) * 2 + (p.raised ? (p.length ?? 1.6) * 0.25 : 0) };
  return { footprint: (p.size ?? 0.15) * 0.9, height: (p.size ?? 0.15) * 0.8 };
}

/** Footprint radius and height of an object, accounting for its params and scale. */
export function sizeOf(o) {
  const m = MODELS[o.model];
  const s = m.size ? m.size(o.params || {}) : { footprint: m.footprint, height: m.height };
  const k = o.scale ?? 1;
  return { footprint: s.footprint * k, height: s.height * k };
}

/** alias (lower-case) -> { model, params } */
export const MODEL_ALIASES = (() => {
  const map = new Map();
  for (const [name, m] of Object.entries(MODELS)) {
    map.set(name.toLowerCase(), { model: name, params: {} });
    for (const a of m.aliases || []) map.set(a, { model: name, params: m.aliasParams?.[a] || {} });
  }
  return map;
})();

export function modelDefaults(name) {
  const out = {};
  for (const [k, v] of Object.entries(MODELS[name].params)) if (v.default !== undefined) out[k] = v.default;
  return out;
}

/** Clamp/validate params against the model schema. Unknown keys are dropped. */
export function sanitizeParams(name, params = {}) {
  const schema = MODELS[name].params;
  const out = {};
  for (const [k, v] of Object.entries(params)) {
    const s = schema[k];
    if (!s) continue;
    if (s.enum) { if (s.enum.includes(v)) out[k] = v; continue; }
    if (s.color) { const c = resolveColor(v); if (c !== undefined) out[k] = c; continue; }
    if (typeof s.default === 'boolean') { out[k] = Boolean(v); continue; }
    const n = Number(v);
    if (Number.isFinite(n)) out[k] = Math.min(s.max ?? Infinity, Math.max(s.min ?? -Infinity, n));
  }
  return out;
}
