// Human character library: data tables used by the Character agent and the
// articulated makeHuman() factory (copied into generated scenes via toString()).
/* eslint-disable no-undef */

// ---------- data the Character agent plans with ----------

// Realistic skin tones (light → deep) plus fantasy tones.
export const SKIN_TONES = {
  pale: 0xf3d7c6, fair: 0xeac3a6, light: 0xe0ac8a, medium: 0xc68e6a, olive: 0xb98a5e,
  tan: 0xa8714c, brown: 0x8d5a3b, dark: 0x6b3f2a, deep: 0x4a2a1c,
  green: 0x6b8e3a, grey: 0x9aa39a, blue: 0x5a7fbf, zombie: 0x8fa57a, undead: 0xd8d4c8,
};
export const HAIR_COLORS = {
  black: 0x16110d, 'dark brown': 0x2e1d12, brown: 0x5a3a20, chestnut: 0x6e3b1e, auburn: 0x8a3a1c,
  red: 0xa8401c, ginger: 0xb8541f, blonde: 0xd8b56a, blond: 0xd8b56a, platinum: 0xece3c8,
  grey: 0x9a9a9a, gray: 0x9a9a9a, silver: 0xc8c8cc, white: 0xeeeeee,
  blue: 0x2f6fd8, pink: 0xf28bb3, purple: 0x8a3fc7, green: 0x3c9a3c,
};
export const EYE_COLORS = { brown: 0x5a3418, 'dark brown': 0x2e1a0c, hazel: 0x8a6a2c, green: 0x3f7f3a, blue: 0x3d77c2, grey: 0x7f8a94, gray: 0x7f8a94, amber: 0xc28a1c, red: 0xc0201a, violet: 0x7a4fc0 };

export const AGES = {
  toddler: { headUnits: 4.3, legRatio: 0.4, height: 0.9 },
  child: { headUnits: 5.6, legRatio: 0.45, height: 1.25 },
  teen: { headUnits: 6.9, legRatio: 0.5, height: 1.62 },
  adult: { headUnits: 7.5, legRatio: 0.5, height: 1.74 },
  elder: { headUnits: 7.3, legRatio: 0.49, height: 1.68 },
};
export const BUILDS = { slim: { girth: 0.86, shoulders: 0.95 }, average: { girth: 1, shoulders: 1 }, athletic: { girth: 1.06, shoulders: 1.16 }, heavy: { girth: 1.32, shoulders: 1.08 } };

export const OUTFITS = ['casual', 'tshirt', 'sport', 'suit', 'dress', 'hoodie', 'sweater', 'armor', 'robe', 'uniform', 'labcoat', 'spacesuit', 'ninja', 'royal', 'rags'];
export const HATS = ['none', 'cap', 'tophat', 'wizard', 'crown', 'helmet', 'hardhat', 'cowboy', 'beanie', 'chef', 'police', 'pirate', 'astronaut', 'hood'];
export const PROPS = ['none', 'sword', 'staff', 'wand', 'shield', 'swordshield', 'torch', 'book', 'briefcase'];
export const HAIR_STYLES = ['short', 'buzz', 'long', 'ponytail', 'bun', 'curly', 'afro', 'bald', 'mohawk', 'spiky', 'bob'];

/**
 * Archetypes: high-level traits the agent starts from. Anything the user says
 * (hair, clothes, age...) overrides these.
 */
export const ARCHETYPES = {
  person: {}, man: { sex: 'male' }, woman: { sex: 'female' }, boy: { sex: 'male', age: 'child' }, girl: { sex: 'female', age: 'child' },
  child: { age: 'child' }, baby: { age: 'toddler' }, teen: { age: 'teen' },
  'old man': { sex: 'male', age: 'elder' }, 'old woman': { sex: 'female', age: 'elder' }, grandpa: { sex: 'male', age: 'elder' }, grandma: { sex: 'female', age: 'elder', hair: 'bun' },
  knight: { sex: 'male', build: 'athletic', outfit: 'armor', hat: 'helmet', prop: 'swordshield', cape: 0x8c1d1d },
  wizard: { sex: 'male', age: 'elder', outfit: 'robe', top: 0x3b2a7a, hat: 'wizard', prop: 'staff', beard: 'full', hair: 'long', hairColor: 0xdddddd },
  witch: { sex: 'female', outfit: 'robe', top: 0x1d1a22, hat: 'wizard', prop: 'wand', hair: 'long', hairColor: 0x16110d },
  king: { sex: 'male', age: 'elder', outfit: 'royal', top: 0x7a1830, hat: 'crown', cape: 0x8a1022, beard: 'full' },
  queen: { sex: 'female', outfit: 'dress', top: 0x5b2a86, hat: 'crown', cape: 0x5b2a86, hair: 'bun' },
  prince: { sex: 'male', age: 'teen', outfit: 'royal', top: 0x2a4a8a, hat: 'crown', cape: 0x2a4a8a },
  princess: { sex: 'female', age: 'teen', outfit: 'dress', top: 0xf28bb3, hat: 'crown', hair: 'long', hairColor: 0xd8b56a },
  soldier: { sex: 'male', build: 'athletic', outfit: 'uniform', top: 0x4b5a32, bottom: 0x4b5a32, hat: 'helmet', accent: 0x4b5a32 },
  police: { outfit: 'uniform', top: 0x1f2f55, bottom: 0x1f2f55, hat: 'police' },
  firefighter: { build: 'athletic', outfit: 'uniform', top: 0x2b2b2b, bottom: 0x2b2b2b, accent: 0xf2d230, hat: 'hardhat', hatColor: 0xc0392b },
  doctor: { outfit: 'labcoat', top: 0xf2f2f2, bottom: 0x2b3a55, glasses: 'glasses' },
  nurse: { sex: 'female', outfit: 'uniform', top: 0x6cc0c8, bottom: 0x6cc0c8, hair: 'bun' },
  scientist: { outfit: 'labcoat', top: 0xf2f2f2, glasses: 'glasses', prop: 'book' },
  chef: { outfit: 'labcoat', top: 0xffffff, bottom: 0x2b2b2b, hat: 'chef' },
  businessman: { sex: 'male', outfit: 'suit', top: 0x22283a, bottom: 0x22283a, prop: 'briefcase' },
  businesswoman: { sex: 'female', outfit: 'suit', top: 0x2f2f38, bottom: 0x2f2f38, hair: 'bob', prop: 'briefcase' },
  farmer: { outfit: 'casual', top: 0x8c2f39, bottom: 0x3b5b8c, hat: 'cowboy', hatColor: 0xc8a96a },
  cowboy: { sex: 'male', outfit: 'casual', top: 0x8a5a2b, bottom: 0x3b5b8c, hat: 'cowboy', hatColor: 0x5a3a20, shoes: 0x5a3a20 },
  astronaut: { outfit: 'spacesuit', hat: 'astronaut' },
  pirate: { sex: 'male', outfit: 'casual', top: 0xeee6d6, bottom: 0x3a2a1e, hat: 'pirate', prop: 'sword', beard: 'full' },
  ninja: { build: 'athletic', outfit: 'ninja', top: 0x141418, bottom: 0x141418, prop: 'sword' },
  athlete: { build: 'athletic', outfit: 'sport', top: 0xd33b2f, bottom: 0x1d1d22, shoes: 0xf5f5f5 },
  runner: { build: 'slim', outfit: 'sport', top: 0x2f6fd8, bottom: 0x1d1d22, shoes: 0xf5f5f5 },
  student: { age: 'teen', outfit: 'hoodie', hair: 'short' },
  worker: { build: 'athletic', outfit: 'uniform', top: 0xf28c28, bottom: 0x3b5b8c, hat: 'hardhat' },
  elf: { build: 'slim', ears: 'pointy', outfit: 'robe', top: 0x2e6b4f, hair: 'long', hairColor: 0xece3c8, height: 1.85 },
  goblin: { age: 'adult', skin: 'green', ears: 'pointy', earScale: 1.8, noseScale: 1.7, outfit: 'rags', top: 0x6b5a3a, height: 1.05, headUnits: 4.8, hair: 'bald', prop: 'sword' },
  orc: { sex: 'male', build: 'heavy', skin: 'green', ears: 'pointy', tusks: true, outfit: 'rags', top: 0x5a4632, height: 2, hair: 'mohawk', hairColor: 0x16110d, prop: 'sword' },
  zombie: { skin: 'zombie', outfit: 'rags', top: 0x5f6b55, bottom: 0x3b3b3b, pose: 'zombie', hair: 'short' },
  vampire: { sex: 'male', skin: 'pale', outfit: 'suit', top: 0x16141a, bottom: 0x16141a, cape: 0x1a0a0e, hair: 'short', hairColor: 0x16110d, eyeColor: 0xc0201a },
  robot: null, // handled by the robot model, never routed here
};
delete ARCHETYPES.robot;

// ---------- the factory ----------

function makeHuman(THREE, M, p, main) {
  const v = p.vary ? rng(4099 + (p.variant ?? 0) * 7919) : null;
  const pick = (a) => a[Math.floor(v() * a.length)];
  let sex = p.sex ?? 'neutral';
  if (v && p.varySex) sex = v() < 0.5 ? 'male' : 'female';
  const m = sex === 'male' ? 1 : sex === 'female' ? 0 : 0.5;
  const skinC = v && p.varySkin ? pick([0xf3d7c6, 0xeac3a6, 0xe0ac8a, 0xc68e6a, 0xb98a5e, 0xa8714c, 0x8d5a3b, 0x6b3f2a, 0x4a2a1c]) : p.skin ?? 0xc68e6a;
  const hairC = v && p.varyHair ? pick([0x16110d, 0x2e1d12, 0x5a3a20, 0xd8b56a, 0xa8401c, 0x6e3b1e]) : p.hairColor ?? 0x2e1d12;
  let hair = p.hair ?? (m < 0.5 ? 'long' : 'short');
  if (v && p.varyHair) hair = m < 0.5 ? pick(['long', 'ponytail', 'bun', 'bob', 'curly']) : pick(['short', 'short', 'buzz', 'curly', 'spiky']);
  const CLOTH = [0x2f4f7f, 0x8c2f39, 0x2e6b4f, 0xd9c7a1, 0x444444, 0xe8e8e8, 0x6b4f8f, 0xc8742f, 0x1f2a44];
  const topC = v && p.varyClothes ? pick(CLOTH) : p.top ?? 0x2f4f7f;
  const botC = v && p.varyClothes ? pick([0x2b3a55, 0x3b3b3b, 0x5a4632, 0x1d1d22, 0x6d7a8a]) : p.bottom ?? 0x2b3a55;
  const outfit = p.outfit ?? 'casual';

  // Proportions in head units (HU): adults ~7.5 heads tall, children ~5.5.
  const H = (p.height ?? 1.74) * (v ? 0.94 + v() * 0.12 : 1);
  const HU = H / (p.headUnits ?? 7.5);
  const G = (p.girth ?? 1) * (outfit === 'spacesuit' ? 1.25 : 1);
  const SH = p.shoulders ?? 1;
  const shoulderW = HU * (1.3 + 0.32 * m) * SH * Math.sqrt(G);
  const hipW = HU * (1.32 - 0.12 * m) * G;
  const hipY = H * (p.legRatio ?? 0.5);
  const shoulderY = H - HU * 1.2;
  const depth = HU * 0.62 * G;

  const mat = (c, r = 0.8, mt = 0, ex) => M(`hum_${c.toString(16)}_${r}_${mt}${ex ? `_${Object.keys(ex).join('')}` : ''}`, { color: c, roughness: r, metalness: mt, ...ex });
  const SKIN = mat(skinC, 0.55);
  const HAIR = mat(hairC, 0.65);
  const metalOutfit = outfit === 'armor';
  const TOP = main || (metalOutfit ? mat(p.accent ?? 0xb8bcc4, 0.32, 1) : mat(topC, outfit === 'suit' || outfit === 'royal' ? 0.55 : 0.85));
  const BOT = metalOutfit ? TOP : outfit === 'spacesuit' ? TOP : mat(outfit === 'ninja' || outfit === 'uniform' ? (p.bottom ?? topC) : botC, 0.85);
  const SHOE = mat(p.shoes ?? (outfit === 'spacesuit' ? 0xe8e8e8 : 0x2a2420), 0.6);
  const ACC = mat(p.accent ?? 0xc9a24a, 0.4, outfit === 'armor' || outfit === 'royal' ? 1 : 0);
  const sleeves = { sport: 'none', dress: 'none', casual: 'short', tshirt: 'short', rags: 'short' }[outfit] ?? 'long';
  const shorts = outfit === 'sport';
  const Q = p.lod === 'low' ? 0.45 : 1; // crowds use a lighter mesh
  const seg = (n) => Math.max(5, Math.round(n * Q));
  const S = (r = 1, w = 24, h = 16) => new THREE.SphereGeometry(r, seg(w), seg(h));
  const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
  };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const limb = (parent, r1, r2, len, material, endCap = true) => {
    add(parent, new THREE.CylinderGeometry(r1, r2, len, seg(14)), material, 0, -len / 2);
    if (endCap) add(parent, S(r2, 14, 10), material, 0, -len);
  };

  const root = new THREE.Group();
  const pelvis = joint(root, 0, hipY, 0);
  // hips + abdomen + chest
  add(pelvis, S(), BOT, 0, HU * 0.05, 0, hipW * 0.5, HU * 0.45, depth * 0.55);
  const spine = joint(pelvis, 0, HU * 0.25, 0);
  const chestH = shoulderY - hipY - HU * 0.25;
  add(spine, new THREE.CylinderGeometry(shoulderW * 0.34, hipW * 0.4, chestH * 0.6, 18), TOP, 0, chestH * 0.3, 0, 1, 1, depth / (shoulderW * 0.6));
  add(spine, S(), TOP, 0, chestH - HU * 0.55, 0, shoulderW * 0.47, HU * 0.75, depth * 0.56);
  if (m < 0.5 && (p.headUnits ?? 7.5) > 6.5) for (const s of [-1, 1]) add(spine, S(HU * 0.17, 14, 10), TOP, s * shoulderW * 0.17, chestH - HU * 0.75, depth * 0.38);
  if (G > 1.2) add(spine, S(), TOP, 0, chestH * 0.25, depth * 0.18, hipW * 0.42, HU * 0.5, depth * 0.5);
  // neck + head
  const neck = joint(spine, 0, chestH - HU * 0.1, 0);
  add(neck, new THREE.CylinderGeometry(HU * 0.16, HU * 0.19, HU * 0.45, 12), outfit === 'spacesuit' || outfit === 'ninja' ? TOP : SKIN, 0, HU * 0.15);
  const head = joint(neck, 0, HU * 0.3, 0);
  const rx = HU * 0.37, ry = HU * 0.5, rz = HU * 0.44, cy = HU * 0.5;
  add(head, S(1, 32, 24), SKIN, 0, cy, 0, rx, ry, rz);
  add(head, S(1, 20, 12), SKIN, 0, cy - HU * 0.2, rz * 0.04, rx * (0.8 + 0.1 * m), ry * 0.56, rz * 0.86); // jaw
  // face
  const kid = (p.headUnits ?? 7.5) < 6 ? 1.25 : 1;
  const ES = (p.eyeScale ?? 1) * kid;
  const eyeY = cy + HU * 0.02, eyeZ = rz * 0.84;
  const WHITE = mat(0xf4f1ea, 0.3), IRIS = mat(p.eyeColor ?? 0x5a3418, 0.3), PUPIL = mat(0x0a0a0a, 0.2);
  for (const s of [-1, 1]) {
    add(head, S(HU * 0.065 * ES, 16, 12), WHITE, s * HU * 0.15, eyeY, eyeZ);
    add(head, S(HU * 0.04 * ES, 12, 8), IRIS, s * HU * 0.15, eyeY, eyeZ + HU * 0.04 * ES);
    add(head, S(HU * 0.02 * ES, 8, 6), PUPIL, s * HU * 0.15, eyeY, eyeZ + HU * 0.065 * ES);
    add(head, new THREE.BoxGeometry(HU * 0.15, HU * 0.028, HU * 0.03), HAIR, s * HU * 0.15, eyeY + HU * 0.12, rz * 0.92).rotation.z = s * -0.08;
    if (p.ears === 'pointy') {
      const e = add(head, new THREE.ConeGeometry(HU * 0.07, HU * 0.38 * (p.earScale ?? 1), 8), SKIN, s * rx * 1.05, cy + HU * 0.08, -HU * 0.02);
      e.rotation.z = s * -1.1;
    } else add(head, S(HU * 0.1, 12, 8), SKIN, s * rx * 0.98, cy, -HU * 0.02, 0.45, 1, 0.75);
  }
  const NS = p.noseScale ?? 1;
  add(head, S(HU * 0.065 * NS, 12, 8), SKIN, 0, cy - HU * 0.08, rz * 0.98, 0.8, 1.15, 1);
  const lip = new THREE.Color(skinC).lerp(new THREE.Color(0xa83c3c), 0.45).getHex();
  const mouth = add(head, new THREE.TorusGeometry(HU * 0.085, HU * 0.016, 6, 16, Math.PI), mat(lip, 0.5), 0, cy - HU * 0.2, rz * 0.9);
  mouth.rotation.z = Math.PI;
  if (p.tusks) for (const s of [-1, 1]) add(head, new THREE.ConeGeometry(HU * 0.035, HU * 0.16, 8), WHITE, s * HU * 0.09, cy - HU * 0.17, rz * 0.92);
  // facial hair
  const beard = p.beard ?? 'none';
  if (beard === 'full') add(head, S(1, 20, 14), HAIR, 0, cy - HU * 0.32, rz * 0.32, rx * 0.88, ry * (0.5 + (p.age === 'elder' ? 0.25 : 0)), rz * 0.66);
  if (beard === 'full' || beard === 'mustache') add(head, new THREE.CapsuleGeometry(HU * 0.03, HU * 0.16, 4, 8), HAIR, 0, cy - HU * 0.15, rz * 0.97).rotation.z = Math.PI / 2;
  if (beard === 'goatee') add(head, S(HU * 0.07, 12, 8), HAIR, 0, cy - HU * 0.33, rz * 0.82, 1, 1.3, 0.8);
  if (beard === 'stubble') add(head, S(1, 20, 12), mat(new THREE.Color(skinC).lerp(new THREE.Color(hairC), 0.35).getHex(), 0.9), 0, cy - HU * 0.2, rz * 0.2, rx * 0.8, ry * 0.56, rz * 0.82);
  // glasses
  if (p.glasses && p.glasses !== 'none') {
    const FR = mat(0x1a1a1a, 0.4, 0.3);
    for (const s of [-1, 1]) {
      add(head, new THREE.TorusGeometry(HU * 0.085, HU * 0.012, 6, 20), FR, s * HU * 0.15, eyeY, rz * 0.98);
      if (p.glasses === 'sunglasses') add(head, new THREE.CircleGeometry(HU * 0.085, 20), mat(0x101010, 0.1, 0.6), s * HU * 0.15, eyeY, rz * 0.985);
    }
    add(head, new THREE.BoxGeometry(HU * 0.1, HU * 0.015, HU * 0.015), FR, 0, eyeY, rz * 1.0);
  }
  // hair
  const cap = (scale = 1.07, open = 0.56, tilt = -0.35) => {
    const c = add(head, new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * open), HAIR, 0, cy + HU * 0.02, -HU * 0.02, rx * scale, ry * scale, rz * scale);
    c.rotation.x = tilt;
    return c;
  };
  if (hair !== 'bald' && !['astronaut', 'helmet', 'beanie', 'hood'].includes(p.hat) && outfit !== 'ninja') {
    if (hair === 'buzz') cap(1.025, 0.52);
    else if (hair === 'afro' || hair === 'curly') {
      const k = hair === 'afro' ? 1.45 : 1.18;
      add(head, new THREE.IcosahedronGeometry(1, 2), mat(hairC, 0.9, 0, { flatShading: true }), 0, cy + HU * 0.12, -HU * 0.06, rx * k, ry * k * 0.92, rz * k);
    } else if (hair === 'mohawk') {
      for (let i = 0; i < 6; i++) { const a = -0.9 + i * 0.36; add(head, new THREE.BoxGeometry(HU * 0.08, HU * 0.22, HU * 0.14), HAIR, 0, cy + Math.cos(a) * ry, Math.sin(a) * rz).rotation.x = a; }
    } else {
      cap(hair === 'spiky' ? 1.05 : 1.07);
      if (hair === 'spiky') for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const c = add(head, new THREE.ConeGeometry(HU * 0.08, HU * 0.25, 6), HAIR, Math.cos(a) * rx * 0.5, cy + ry * 0.92, Math.sin(a) * rz * 0.5 - HU * 0.05); c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5); }
      if (hair === 'long') {
        add(head, new THREE.CapsuleGeometry(1, 1, 6, 16), HAIR, 0, cy - HU * 0.55, -rz * 0.45, rx * 1.02, HU * 0.6, rz * 0.45);
        for (const s of [-1, 1]) add(head, new THREE.CapsuleGeometry(HU * 0.1, HU * 0.7, 4, 10), HAIR, s * rx * 0.92, cy - HU * 0.35, -rz * 0.05);
      }
      if (hair === 'bob') add(head, new THREE.CylinderGeometry(rx * 1.12, rx * 1.18, HU * 0.55, 24, 1, true), mat(hairC, 0.65, 0, { side: THREE.DoubleSide }), 0, cy - HU * 0.12, -HU * 0.04, 1, 1, rz / rx);
      if (hair === 'ponytail') { const t = add(head, new THREE.CapsuleGeometry(HU * 0.1, HU * 0.6, 4, 10), HAIR, 0, cy - HU * 0.15, -rz * 1.15); t.rotation.x = 0.35; }
      if (hair === 'bun') add(head, S(HU * 0.2, 16, 12), HAIR, 0, cy + HU * 0.38, -rz * 0.75);
    }
  }
  // hats
  const hatC = p.hatColor;
  const hat = p.hat ?? 'none';
  const top = cy + ry;
  if (hat === 'cap' || hat === 'police') {
    const C = mat(hatC ?? (hat === 'police' ? 0x1f2f55 : 0xc0392b), 0.7);
    add(head, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, cy + HU * 0.12, 0, rx * 1.1, ry * 0.85, rz * 1.1);
    add(head, new THREE.CylinderGeometry(rx * 0.9, rx * 0.9, HU * 0.03, 20, 1, false, -Math.PI / 2, Math.PI), C, 0, cy + HU * 0.13, rz * 0.7, 1, 1, 0.9);
    if (hat === 'police') add(head, new THREE.CylinderGeometry(rx * 1.25, rx * 1.12, HU * 0.18, 24), C, 0, top - HU * 0.02, 0);
  } else if (hat === 'tophat') {
    const C = mat(hatC ?? 0x16141a, 0.5);
    add(head, new THREE.CylinderGeometry(rx * 1.6, rx * 1.6, HU * 0.03, 28), C, 0, top - HU * 0.08, 0);
    add(head, new THREE.CylinderGeometry(rx * 0.95, rx * 0.95, HU * 0.7, 24), C, 0, top + HU * 0.28, 0);
  } else if (hat === 'wizard') {
    const C = mat(hatC ?? (p.top ?? 0x3b2a7a), 0.85);
    add(head, new THREE.CylinderGeometry(rx * 1.9, rx * 1.9, HU * 0.03, 28), C, 0, top - HU * 0.12, 0);
    const c = add(head, new THREE.ConeGeometry(rx * 1.05, HU * 1.5, 24), C, 0, top + HU * 0.6, -HU * 0.05);
    c.rotation.x = -0.12;
  } else if (hat === 'crown') {
    const C = mat(0xffc356, 0.25, 1);
    add(head, new THREE.CylinderGeometry(rx * 0.95, rx * 0.9, HU * 0.2, 20, 1, true), M('crown_ds', { color: 0xffc356, roughness: 0.25, metalness: 1, side: THREE.DoubleSide }), 0, top + HU * 0.02, 0);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(head, new THREE.ConeGeometry(HU * 0.05, HU * 0.14, 6), C, Math.cos(a) * rx * 0.93, top + HU * 0.18, Math.sin(a) * rx * 0.93); }
    add(head, S(HU * 0.04, 8, 6), mat(0xc0201a, 0.1), 0, top + HU * 0.04, rx * 0.95);
  } else if (hat === 'helmet' || hat === 'hardhat') {
    const C = hat === 'hardhat' ? mat(hatC ?? 0xf2c230, 0.4) : mat(p.accent ?? 0xa8adb6, 0.3, 1);
    add(head, new THREE.SphereGeometry(1, 28, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), C, 0, cy + HU * 0.05, 0, rx * 1.18, ry * 1.08, rz * 1.18);
    if (hat === 'hardhat') add(head, new THREE.CylinderGeometry(rx * 1.45, rx * 1.45, HU * 0.03, 24), C, 0, cy + HU * 0.08, HU * 0.05);
    if (hat === 'helmet' && outfit === 'armor') add(head, new THREE.BoxGeometry(HU * 0.06, HU * 0.5, HU * 0.08), C, 0, cy - HU * 0.05, rz * 1.12);
  } else if (hat === 'cowboy') {
    const C = mat(hatC ?? 0x8a5a2b, 0.8);
    const b = add(head, new THREE.CylinderGeometry(rx * 2.1, rx * 2.1, HU * 0.03, 28), C, 0, top - HU * 0.1, 0, 1, 1, 0.85);
    b.rotation.x = 0.05;
    add(head, new THREE.CylinderGeometry(rx * 0.85, rx * 1.0, HU * 0.42, 20), C, 0, top + HU * 0.08, 0);
  } else if (hat === 'beanie') {
    add(head, new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat(hatC ?? 0x8c2f39, 0.95), 0, cy + HU * 0.08, -HU * 0.02, rx * 1.12, ry * 1.08, rz * 1.12);
  } else if (hat === 'chef') {
    const C = mat(0xffffff, 0.9);
    add(head, new THREE.CylinderGeometry(rx * 1.05, rx * 1.02, HU * 0.4, 20), C, 0, top + HU * 0.05, 0);
    add(head, S(1, 20, 12), C, 0, top + HU * 0.35, 0, rx * 1.35, HU * 0.3, rx * 1.35);
  } else if (hat === 'pirate') {
    const C = mat(hatC ?? 0x16141a, 0.8);
    add(head, new THREE.CylinderGeometry(rx * 1.75, rx * 1.75, HU * 0.05, 3), C, 0, top - HU * 0.1, 0).rotation.y = -Math.PI / 2;
    add(head, new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, top - HU * 0.12, 0, rx * 1.05, HU * 0.38, rz * 1.05);
    add(head, new THREE.CircleGeometry(HU * 0.1, 12), mat(0xf4f1ea, 0.5), 0, top + HU * 0.05, rz * 1.0);
  } else if (hat === 'astronaut') {
    const g = add(head, S(1, 32, 24), M('visor', { color: 0xbfe6ff, roughness: 0.05, transmission: 0.85, thickness: 0.1, ior: 1.3, transparent: true, opacity: 0.6 }, 'MeshPhysicalMaterial'), 0, cy, HU * 0.02, rx * 1.6, ry * 1.32, rz * 1.55);
    g.userData.noShadow = true;
    g.userData.keep = true;
  } else if (hat === 'hood') {
    add(head, new THREE.SphereGeometry(1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.7), TOP, 0, cy + HU * 0.02, -HU * 0.06, rx * 1.25, ry * 1.18, rz * 1.22).rotation.x = -0.6;
  }
  if (outfit === 'ninja') add(head, S(1, 24, 12), TOP, 0, cy - HU * 0.1, HU * 0.02, rx * 1.04, ry * 0.68, rz * 1.04);
  // outfit details on the torso
  const chestTop = chestH;
  if (outfit === 'suit' || outfit === 'royal') {
    add(spine, new THREE.BoxGeometry(HU * 0.3, HU * 0.5, HU * 0.02), mat(0xf4f4f4, 0.6), 0, chestTop - HU * 0.42, depth * 0.53);
    if (outfit === 'suit') add(spine, new THREE.BoxGeometry(HU * 0.08, HU * 0.55, HU * 0.02), mat(p.accent ?? 0x9c1f2a, 0.5), 0, chestTop - HU * 0.5, depth * 0.56);
    else for (let i = 0; i < 4; i++) add(spine, S(HU * 0.035, 8, 6), ACC, 0, chestTop - HU * (0.4 + i * 0.25), depth * 0.55);
  }
  if (outfit === 'hoodie') add(spine, new THREE.TorusGeometry(HU * 0.28, HU * 0.1, 8, 20), TOP, 0, chestTop - HU * 0.05, -HU * 0.12).rotation.x = Math.PI / 2.4;
  if (outfit === 'armor') {
    for (const s of [-1, 1]) add(spine, new THREE.SphereGeometry(HU * 0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), TOP, s * shoulderW * 0.5, chestTop - HU * 0.12, 0);
    add(pelvis, new THREE.CylinderGeometry(hipW * 0.52, hipW * 0.52, HU * 0.12, 20), mat(0x4a3424, 0.7), 0, HU * 0.3, 0, 1, 1, depth / hipW * 1.1);
  }
  if (outfit === 'uniform') add(pelvis, new THREE.CylinderGeometry(hipW * 0.51, hipW * 0.51, HU * 0.1, 20), mat(0x1a1a1a, 0.5), 0, HU * 0.3, 0, 1, 1, depth / hipW * 1.1);
  if (outfit === 'uniform' && p.accent) for (const y of [0.35, 0.75]) add(spine, new THREE.CylinderGeometry(shoulderW * 0.45, shoulderW * 0.45, HU * 0.06, 20), ACC, 0, chestTop - HU * y, 0, 1, 1, depth / shoulderW * 1.2);
  if (outfit === 'spacesuit') add(spine, new THREE.BoxGeometry(shoulderW * 0.8, HU * 1.4, HU * 0.4), mat(0xd8d8d8, 0.6), 0, chestTop - HU * 0.9, -depth * 0.7);
  // skirts / robes / coats
  const skirt = { dress: [hipW * 0.5, hipW * 0.95, hipY * 0.5], robe: [hipW * 0.55, hipW * 1.0, hipY * 0.95], royal: [hipW * 0.55, hipW * 0.95, hipY * 0.7], labcoat: [hipW * 0.55, hipW * 0.7, hipY * 0.45] }[outfit];
  if (skirt) {
    const [r1, r2, len] = skirt;
    add(pelvis, new THREE.CylinderGeometry(r1, r2, len, 24, 1, outfit === 'labcoat'), outfit === 'labcoat' ? M(`hum_coat_${topC.toString(16)}`, { color: topC, roughness: 0.85, side: THREE.DoubleSide }) : TOP, 0, HU * 0.3 - len / 2, 0, 1, 1, depth / hipW * 1.25);
  }
  if (p.cape) {
    const c = add(spine, new THREE.BoxGeometry(shoulderW * 1.05, shoulderY * 0.82, HU * 0.04), M(`hum_cape_${p.cape.toString(16)}`, { color: p.cape, roughness: 0.75, side: THREE.DoubleSide }), 0, chestTop - shoulderY * 0.41, -depth * 0.62);
    c.rotation.x = 0.06;
  }
  if (outfit === 'rags') add(spine, new THREE.ConeGeometry(shoulderW * 0.55, HU * 0.5, 7, 1, true), M(`hum_rag_${topC.toString(16)}`, { color: topC, roughness: 0.95, side: THREE.DoubleSide, flatShading: true }), 0, -HU * 0.2, 0).rotation.x = Math.PI;

  // arms
  const armR = HU * 0.19 * Math.pow(G, 0.7) * (SH > 1.1 ? 1.12 : 1);
  const upper = HU * 1.42, fore = HU * 1.22;
  const sleeveFore = sleeves === 'long' ? TOP : SKIN;
  const sleeveUp = sleeves === 'none' ? SKIN : TOP;
  const handMat = outfit === 'armor' || outfit === 'spacesuit' ? TOP : SKIN;
  const arms = [];
  for (const s of [1, -1]) {
    const sh = joint(spine, s * (shoulderW / 2 - armR * 0.6), chestTop - HU * 0.2, 0);
    add(sh, S(armR * 1.02, 14, 10), sleeveUp, s * -armR * 0.15, 0, 0);
    limb(sh, armR, armR * 0.82, upper, sleeveUp);
    const el = joint(sh, 0, -upper, 0);
    limb(el, armR * 0.82, armR * 0.6, fore, sleeveFore);
    const hand = joint(el, 0, -fore, 0);
    add(hand, S(1, 12, 10), handMat, 0, -HU * 0.3, HU * 0.02, HU * 0.1, HU * 0.32, HU * 0.15);
    add(hand, new THREE.CapsuleGeometry(HU * 0.045, HU * 0.15, 4, 6), handMat, -s * HU * 0.08, -HU * 0.22, HU * 0.1).rotation.z = s * 0.5;
    arms.push({ sh, el, hand });
  }
  // legs
  const legLen = hipY - HU * 0.12;
  const thigh = legLen * 0.5, shin = legLen * 0.47;
  const legs = [];
  for (const s of [1, -1]) {
    const hp = joint(pelvis, s * hipW * 0.24, 0, 0);
    limb(hp, HU * 0.29 * G, HU * 0.19 * Math.sqrt(G), thigh, BOT);
    const kn = joint(hp, 0, -thigh, 0);
    limb(kn, HU * 0.19 * Math.sqrt(G), HU * 0.12, shin, shorts ? SKIN : BOT, false);
    const an = joint(kn, 0, -shin, 0);
    add(an, new THREE.CapsuleGeometry(HU * 0.14, HU * 0.6, 4, 10), SHOE, 0, -HU * 0.06, HU * 0.24, 1.15, 0.85, 1).rotation.x = Math.PI / 2;
    legs.push({ hp, kn, an });
  }
  // props
  const [right, left] = [arms[1], arms[0]];
  const prop = p.prop ?? 'none';
  const STEEL = mat(0xd0d4da, 0.2, 1), WOOD = mat(0x6b4423, 0.8);
  if (prop === 'sword' || prop === 'swordshield') {
    const sw = joint(right.hand, 0, -HU * 0.32, HU * 0.05);
    sw.rotation.x = -1.2;
    add(sw, new THREE.BoxGeometry(HU * 0.1, HU * 2.4, HU * 0.03), STEEL, 0, HU * 1.35, 0);
    add(sw, new THREE.BoxGeometry(HU * 0.5, HU * 0.06, HU * 0.08), ACC, 0, HU * 0.15, 0);
    add(sw, new THREE.CylinderGeometry(HU * 0.04, HU * 0.04, HU * 0.35, 8), mat(0x3a2414, 0.8), 0, -HU * 0.05, 0);
  }
  if (prop === 'shield' || prop === 'swordshield') {
    const sd = add(left.el, new THREE.CylinderGeometry(HU * 0.75, HU * 0.75, HU * 0.08, 24), mat(p.cape ?? 0x8c1d1d, 0.6, 0.2), HU * 0.25, -fore * 0.5, 0);
    sd.rotation.z = Math.PI / 2;
    add(left.el, new THREE.CylinderGeometry(HU * 0.2, HU * 0.2, HU * 0.1, 16), ACC, HU * 0.3, -fore * 0.5, 0).rotation.z = Math.PI / 2;
  }
  if (prop === 'staff') {
    const len = H * 1.08;
    const st = joint(right.hand, 0, -HU * 0.3, HU * 0.06);
    add(st, new THREE.CylinderGeometry(HU * 0.05, HU * 0.06, len, 8), WOOD, 0, len * 0.5 - hipY * 0.9, 0);
    add(st, new THREE.IcosahedronGeometry(HU * 0.16, 0), M('orb', { color: 0x7fd8ff, emissive: 0x3fb8ff, emissiveIntensity: 2, roughness: 0.2 }), 0, len - hipY * 0.9 + HU * 0.1, 0);
  }
  if (prop === 'wand') { const w = joint(right.hand, 0, -HU * 0.35, HU * 0.1); w.rotation.x = -1.4; add(w, new THREE.CylinderGeometry(HU * 0.015, HU * 0.025, HU * 0.8, 6), WOOD, 0, HU * 0.4, 0); }
  if (prop === 'torch') { const t = joint(right.hand, 0, -HU * 0.3, HU * 0.05); t.rotation.x = -0.9; add(t, new THREE.CylinderGeometry(HU * 0.05, HU * 0.04, HU * 1.1, 8), WOOD, 0, HU * 0.4, 0); add(t, new THREE.ConeGeometry(HU * 0.12, HU * 0.35, 8), M('flame', { color: 0xffaa33, emissive: 0xff6a00, emissiveIntensity: 3 }), 0, HU * 1.05, 0); }
  if (prop === 'book') add(left.hand, new THREE.BoxGeometry(HU * 0.5, HU * 0.65, HU * 0.12), mat(0x7a1830, 0.7), 0, -HU * 0.45, HU * 0.15);
  if (prop === 'briefcase') { add(right.hand, new THREE.BoxGeometry(HU * 0.25, HU * 0.75, HU * 1.0), mat(0x3a2414, 0.5), 0, -HU * 0.8, 0); }

  mergeParts(root);

  // ---- rig: idle / walk / run / wave / dance (+ zombie pose) ----
  const zombie = p.pose === 'zombie', riding = p.pose === 'ride', elder = (p.age === 'elder');
  const [aL, aR] = arms, [lL, lR] = legs;
  const all = [pelvis, spine, neck, head, aL.sh, aR.sh, aL.el, aR.el, lL.hp, lR.hp, lL.kn, lR.kn, lL.an, lR.an];
  const rest = () => {
    for (const j of all) j.rotation.set(0, 0, 0);
    pelvis.position.y = hipY;
    aL.sh.rotation.z = 0.08; aR.sh.rotation.z = -0.08;
    aL.el.rotation.x = aR.el.rotation.x = -0.15;
    if (elder) { spine.rotation.x = 0.12; head.rotation.x = -0.1; }
    if (zombie) { aL.sh.rotation.x = aR.sh.rotation.x = -1.35; aL.el.rotation.x = aR.el.rotation.x = -0.1; head.rotation.z = 0.2; }
    if (riding) { lL.hp.rotation.set(-1.35, 0, 0.38); lR.hp.rotation.set(-1.35, 0, -0.38); lL.kn.rotation.x = lR.kn.rotation.x = 1.35; aL.sh.rotation.x = aR.sh.rotation.x = -0.45; aL.el.rotation.x = aR.el.rotation.x = -0.9; }
    if (prop === 'staff') { aR.el.rotation.x = -0.9; aR.sh.rotation.x = -0.2; }
    if (prop === 'swordshield' || prop === 'shield') { aL.el.rotation.x = -1.2; aL.sh.rotation.z = 0.25; }
  };
  root.userData.rig = (t, mode) => {
    rest();
    const breathe = Math.sin(t * 1.6);
    if ((mode === 'walk' || mode === 'run') && !riding) {
      const run = mode === 'run', ph = t * (run ? 9 : 5.5), A = run ? 0.85 : 0.42;
      lL.hp.rotation.x = Math.sin(ph) * A; lR.hp.rotation.x = -Math.sin(ph) * A;
      lL.kn.rotation.x = Math.max(0, -Math.cos(ph)) * A * 1.6; lR.kn.rotation.x = Math.max(0, Math.cos(ph)) * A * 1.6;
      if (!zombie) { aL.sh.rotation.x = -Math.sin(ph) * A * 0.8; aR.sh.rotation.x = Math.sin(ph) * A * 0.8; }
      if (run) aL.el.rotation.x = aR.el.rotation.x = -1.3;
      pelvis.position.y = hipY + Math.abs(Math.cos(ph)) * H * (run ? 0.03 : 0.012);
      spine.rotation.x += run ? 0.18 : 0.03;
      spine.rotation.y = Math.sin(ph) * 0.07;
    } else if (mode === 'wave') {
      aR.sh.rotation.z = -2.55; aR.el.rotation.z = -0.35 + Math.sin(t * 9) * 0.45; aR.el.rotation.x = 0;
      head.rotation.z = 0.08;
      spine.rotation.x += breathe * 0.012;
    } else if (mode === 'dance') {
      const b = Math.sin(t * 5);
      pelvis.rotation.z = b * 0.1; pelvis.position.y = hipY - Math.abs(b) * H * 0.02;
      aL.sh.rotation.z = 2.2 + b * 0.4; aR.sh.rotation.z = -2.2 + b * 0.4;
      aL.el.rotation.z = 0.6; aR.el.rotation.z = -0.6;
      lL.kn.rotation.x = lR.kn.rotation.x = Math.abs(b) * 0.3; lL.hp.rotation.x = lR.hp.rotation.x = -Math.abs(b) * 0.15;
      head.rotation.z = -b * 0.15;
    } else {
      spine.rotation.x += breathe * 0.012;
      aL.sh.rotation.z += breathe * 0.015; aR.sh.rotation.z -= breathe * 0.015;
      head.rotation.y = Math.sin(t * 0.37) * 0.3;
      pelvis.rotation.z = Math.sin(t * 0.5) * 0.02;
    }
  };
  root.userData.hipY = hipY;
  root.userData.rig(0, 'idle');
  return root;
}

export const HUMAN_FACTORY = makeHuman;
