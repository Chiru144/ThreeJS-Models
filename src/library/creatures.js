// Creature library: species presets (planned by the Creature agent) and five
// articulated body-plan factories: quadruped, bird, fish, serpent, arthropod.
/* eslint-disable no-undef */

// ---------- species presets (metres; body faces +z) ----------
export const SPECIES = {
  // quadrupeds
  dog: { plan: 'quadruped', bodyLen: 0.75, bodyH: 0.3, bodyW: 0.25, legLen: 0.36, neckLen: 0.2, neckAngle: 0.9, headLen: 0.26, headH: 0.17, snout: 0.12, ears: 'floppy', earSize: 0.11, tail: 'thin', tailLen: 0.32, tailUp: 0.7, coat: 0xb07a45, belly: 0xe8d3b0 },
  puppy: { plan: 'quadruped', bodyLen: 0.4, bodyH: 0.2, bodyW: 0.17, legLen: 0.18, neckLen: 0.1, neckAngle: 0.9, headLen: 0.2, headH: 0.15, snout: 0.06, ears: 'floppy', earSize: 0.08, tail: 'thin', tailLen: 0.15, tailUp: 0.9, coat: 0xd8a868, belly: 0xf0e0c0 },
  wolf: { plan: 'quadruped', bodyLen: 1.05, bodyH: 0.36, bodyW: 0.28, legLen: 0.5, neckLen: 0.25, neckAngle: 0.6, headLen: 0.3, headH: 0.18, snout: 0.16, ears: 'pointy', earSize: 0.1, tail: 'bushy', tailLen: 0.45, tailUp: -0.3, coat: 0x7d7a74, belly: 0xc8c4bc },
  fox: { plan: 'quadruped', bodyLen: 0.6, bodyH: 0.22, bodyW: 0.18, legLen: 0.28, neckLen: 0.14, neckAngle: 0.7, headLen: 0.2, headH: 0.12, snout: 0.11, ears: 'pointy', earSize: 0.09, tail: 'bushy', tailLen: 0.42, tailUp: 0.1, tailTip: 0xf5f5f0, coat: 0xd8642a, belly: 0xf5f0e6, accent: 0x2a1a12 },
  cat: { plan: 'quadruped', bodyLen: 0.48, bodyH: 0.19, bodyW: 0.15, legLen: 0.22, neckLen: 0.1, neckAngle: 0.9, headLen: 0.13, headH: 0.12, snout: 0.03, ears: 'pointy', earSize: 0.06, tail: 'thin', tailLen: 0.42, tailUp: 1.3, coat: 0x8a8580, belly: 0xd8d4cc, eye: 0x9ccf3a },
  horse: { plan: 'quadruped', bodyLen: 1.55, bodyH: 0.7, bodyW: 0.5, legLen: 0.95, neckLen: 0.75, neckAngle: 0.85, headLen: 0.55, headH: 0.24, snout: 0.25, headPitch: 0.5, ears: 'pointy', earSize: 0.12, tail: 'long', tailLen: 0.8, tailUp: -0.6, mane: true, hooves: true, coat: 0x6b3e1f, accent: 0x1c1410 },
  pony: { plan: 'quadruped', bodyLen: 1.0, bodyH: 0.5, bodyW: 0.4, legLen: 0.55, neckLen: 0.45, neckAngle: 0.85, headLen: 0.4, headH: 0.2, snout: 0.16, headPitch: 0.5, ears: 'pointy', earSize: 0.09, tail: 'long', tailLen: 0.55, tailUp: -0.6, mane: true, hooves: true, coat: 0xc8a06a, accent: 0xf0e6d0 },
  zebra: { plan: 'quadruped', bodyLen: 1.4, bodyH: 0.65, bodyW: 0.46, legLen: 0.85, neckLen: 0.65, neckAngle: 0.85, headLen: 0.5, headH: 0.22, snout: 0.22, headPitch: 0.5, ears: 'pointy', earSize: 0.13, tail: 'tuft', tailLen: 0.5, tailUp: -0.8, mane: true, hooves: true, stripes: 9, coat: 0xf2f2f0, accent: 0x161616 },
  unicorn: { plan: 'quadruped', bodyLen: 1.5, bodyH: 0.68, bodyW: 0.48, legLen: 0.95, neckLen: 0.75, neckAngle: 0.9, headLen: 0.52, headH: 0.23, snout: 0.22, headPitch: 0.45, ears: 'pointy', earSize: 0.12, tail: 'long', tailLen: 0.8, tailUp: -0.5, mane: true, hooves: true, horns: 'unicorn', hornColor: 0xffd86b, coat: 0xf6f3ff, accent: 0xc8a6f0 },
  pegasus: { plan: 'quadruped', bodyLen: 1.5, bodyH: 0.68, bodyW: 0.48, legLen: 0.95, neckLen: 0.75, neckAngle: 0.9, headLen: 0.52, headH: 0.23, snout: 0.22, headPitch: 0.45, ears: 'pointy', earSize: 0.12, tail: 'long', tailLen: 0.8, tailUp: -0.5, mane: true, hooves: true, wings: 'feather', wingSpan: 1.6, coat: 0xf6f6f6, accent: 0xd8d8e8 },
  cow: { plan: 'quadruped', bodyLen: 1.6, bodyH: 0.8, bodyW: 0.62, legLen: 0.72, neckLen: 0.35, neckAngle: 0.3, headLen: 0.5, headH: 0.3, snout: 0.15, headPitch: 0.3, ears: 'side', earSize: 0.14, horns: 'short', tail: 'tuft', tailLen: 0.7, tailUp: -1.1, hooves: true, spots: 7, coat: 0xf2f0ea, accent: 0x1c1c1c, nose: 0xe8a0a0 },
  bull: { plan: 'quadruped', bodyLen: 1.8, bodyH: 0.95, bodyW: 0.75, legLen: 0.7, neckLen: 0.3, neckAngle: 0.2, headLen: 0.55, headH: 0.35, snout: 0.15, headPitch: 0.2, ears: 'side', earSize: 0.14, horns: 'curved', tail: 'tuft', tailLen: 0.7, tailUp: -1.1, hooves: true, coat: 0x2a1c14, accent: 0x111111 },
  pig: { plan: 'quadruped', bodyLen: 0.95, bodyH: 0.5, bodyW: 0.45, legLen: 0.24, neckLen: 0.08, neckAngle: 0.1, headLen: 0.3, headH: 0.26, snout: 0.1, snoutFlat: true, ears: 'floppy', earSize: 0.11, tail: 'curl', tailLen: 0.1, tailUp: 0.5, hooves: true, coat: 0xf2a7a0, nose: 0xe88c88 },
  sheep: { plan: 'quadruped', bodyLen: 1.0, bodyH: 0.6, bodyW: 0.55, legLen: 0.42, neckLen: 0.2, neckAngle: 0.6, headLen: 0.28, headH: 0.18, snout: 0.1, ears: 'side', earSize: 0.09, tail: 'puff', tailLen: 0.1, woolly: true, hooves: true, coat: 0xf0ece0, accent: 0x2a2420, headColor: 0x2a2420 },
  goat: { plan: 'quadruped', bodyLen: 0.9, bodyH: 0.42, bodyW: 0.32, legLen: 0.5, neckLen: 0.3, neckAngle: 0.8, headLen: 0.3, headH: 0.16, snout: 0.12, headPitch: 0.3, ears: 'side', earSize: 0.09, horns: 'curved', tail: 'thin', tailLen: 0.12, tailUp: 1.1, hooves: true, coat: 0xe8e0d0, accent: 0x7a6a5a },
  deer: { plan: 'quadruped', bodyLen: 1.2, bodyH: 0.48, bodyW: 0.36, legLen: 0.85, neckLen: 0.5, neckAngle: 1.05, headLen: 0.36, headH: 0.16, snout: 0.15, headPitch: 0.4, ears: 'pointy', earSize: 0.13, horns: 'antlers', hornColor: 0xd8c8a8, tail: 'puff', tailLen: 0.1, hooves: true, coat: 0xa0683a, belly: 0xe8d8c0 },
  bear: { plan: 'quadruped', bodyLen: 1.5, bodyH: 0.8, bodyW: 0.75, legLen: 0.5, legR: 0.13, neckLen: 0.22, neckAngle: 0.3, headLen: 0.4, headH: 0.32, snout: 0.14, ears: 'round', earSize: 0.09, tail: 'puff', tailLen: 0.08, coat: 0x5a3a22, nose: 0x1a1a1a },
  'polar bear': { plan: 'quadruped', bodyLen: 1.7, bodyH: 0.85, bodyW: 0.78, legLen: 0.55, legR: 0.14, neckLen: 0.35, neckAngle: 0.35, headLen: 0.42, headH: 0.3, snout: 0.16, ears: 'round', earSize: 0.07, tail: 'puff', tailLen: 0.08, coat: 0xf2efe6, nose: 0x1a1a1a },
  lion: { plan: 'quadruped', bodyLen: 1.6, bodyH: 0.6, bodyW: 0.48, legLen: 0.6, legR: 0.09, neckLen: 0.25, neckAngle: 0.6, headLen: 0.42, headH: 0.32, snout: 0.12, ears: 'round', earSize: 0.07, tail: 'tuft', tailLen: 0.8, tailUp: -0.4, lionMane: true, coat: 0xc9a063, accent: 0x7a4a22, eye: 0xc28a1c },
  tiger: { plan: 'quadruped', bodyLen: 1.7, bodyH: 0.6, bodyW: 0.48, legLen: 0.55, legR: 0.09, neckLen: 0.25, neckAngle: 0.6, headLen: 0.4, headH: 0.3, snout: 0.11, ears: 'round', earSize: 0.07, tail: 'thin', tailLen: 0.9, tailUp: -0.2, stripes: 11, coat: 0xe07a24, belly: 0xf5ecdc, accent: 0x161616, eye: 0xc28a1c },
  elephant: { plan: 'quadruped', bodyLen: 2.6, bodyH: 1.7, bodyW: 1.45, legLen: 1.25, legR: 0.24, neckLen: 0.1, neckAngle: 0.4, headLen: 0.8, headH: 0.85, snout: 0, trunk: true, tusks: true, ears: 'big', earSize: 0.65, tail: 'tuft', tailLen: 0.9, tailUp: -1.3, coat: 0x8a8a86, accent: 0x3a3a38 },
  giraffe: { plan: 'quadruped', bodyLen: 1.7, bodyH: 0.85, bodyW: 0.6, legLen: 1.6, neckLen: 1.9, neckAngle: 1.2, neckR: 0.13, headLen: 0.5, headH: 0.2, snout: 0.18, headPitch: 0.9, ears: 'pointy', earSize: 0.1, horns: 'ossicones', tail: 'tuft', tailLen: 0.8, tailUp: -1.1, hooves: true, spots: 22, coat: 0xe8b860, accent: 0x7a4418 },
  rabbit: { plan: 'quadruped', bodyLen: 0.32, bodyH: 0.22, bodyW: 0.2, legLen: 0.08, neckLen: 0.04, neckAngle: 0.8, headLen: 0.14, headH: 0.12, snout: 0.03, ears: 'long', earSize: 0.15, tail: 'puff', tailLen: 0.05, coat: 0xd8c8b4, belly: 0xf5f0e8, nose: 0xe8a0a0 },
  mouse: { plan: 'quadruped', bodyLen: 0.1, bodyH: 0.05, bodyW: 0.05, legLen: 0.02, neckLen: 0.01, neckAngle: 0.5, headLen: 0.05, headH: 0.035, snout: 0.02, ears: 'round', earSize: 0.02, tail: 'thin', tailLen: 0.1, tailUp: 0, coat: 0x9a9088, nose: 0xe8a0a0 },
  dragon: { plan: 'quadruped', bodyLen: 2.4, bodyH: 0.8, bodyW: 0.75, legLen: 0.75, legR: 0.13, neckLen: 1.2, neckAngle: 0.75, neckR: 0.2, headLen: 0.6, headH: 0.3, snout: 0.32, headPitch: 0.35, ears: 'none', horns: 'curved', hornColor: 0xe8dcc0, tail: 'dragon', tailLen: 2.6, tailUp: -0.2, wings: 'membrane', wingSpan: 2.6, spikes: true, scaly: true, coat: 0x2e7d4f, belly: 0xd9c27a, accent: 0x1d4f33, eye: 0xffc21a },
  dinosaur: { plan: 'quadruped', bodyLen: 3, bodyH: 1.1, bodyW: 0.95, legLen: 0.95, legR: 0.22, neckLen: 1.6, neckAngle: 0.7, neckR: 0.3, headLen: 0.45, headH: 0.25, snout: 0.15, ears: 'none', tail: 'dragon', tailLen: 3, tailUp: 0.1, scaly: true, coat: 0x6b8e4a, belly: 0xc8c08a, accent: 0x4a6a32 },
  // birds
  bird: { plan: 'bird', size: 0.18, body: 0x3d77c2, belly: 0xf2e6d0, wing: 0x2a5aa0, beak: 0xf2b230, legs: 0xe08a30 },
  sparrow: { plan: 'bird', size: 0.15, body: 0x8a6a4a, belly: 0xe8dcc8, wing: 0x6a4a2a, beak: 0x3a3a3a, legs: 0xb08a6a },
  eagle: { plan: 'bird', size: 0.8, body: 0x5a3a22, belly: 0x5a3a22, wing: 0x4a2e1a, head: 0xf5f5f0, beak: 0xf2c230, legs: 0xf2c230, beakHook: true },
  owl: { plan: 'bird', size: 0.45, upright: 1, body: 0x8a6a4a, belly: 0xd8c8a8, wing: 0x6a4e34, beak: 0x3a3a3a, legs: 0x8a7a6a, bigEyes: true, eye: 0xf2b230, ears: true },
  parrot: { plan: 'bird', size: 0.35, body: 0xd33b2f, belly: 0xd33b2f, wing: 0x2f6fd8, head: 0xd33b2f, beak: 0xf0e6d6, legs: 0x6a6a6a, beakHook: true, tailLen: 0.8 },
  penguin: { plan: 'bird', size: 0.6, upright: 1, flightless: true, body: 0x16161a, belly: 0xf5f5f5, wing: 0x16161a, beak: 0xf2a030, legs: 0xf2a030, head: 0x16161a },
  duck: { plan: 'bird', size: 0.35, body: 0xf2f2ec, belly: 0xf2f2ec, wing: 0xe0e0d8, head: 0x2e6b4f, beak: 0xf2a030, legs: 0xf2a030, beakFlat: true },
  chicken: { plan: 'bird', size: 0.35, upright: 0.4, body: 0xf5f0e6, belly: 0xf5f0e6, wing: 0xe8e0d0, beak: 0xf2c230, legs: 0xf2c230, comb: true },
  flamingo: { plan: 'bird', size: 0.5, body: 0xf28bb3, belly: 0xf5a8c8, wing: 0xe86a9a, beak: 0x1a1a1a, legs: 0xe8789a, legLen: 2.6, neckLen: 1.8 },
  crow: { plan: 'bird', size: 0.4, body: 0x141418, belly: 0x1e1e24, wing: 0x101014, beak: 0x141418, legs: 0x141418 },
  // fish
  fish: { plan: 'fish', length: 0.4, body: 0xf28c28, belly: 0xf5c87a, fin: 0xf2a85a },
  goldfish: { plan: 'fish', length: 0.2, body: 0xf28c28, belly: 0xf5c87a, fin: 0xf2a85a, tailSize: 1.5 },
  clownfish: { plan: 'fish', length: 0.15, body: 0xf27a1a, belly: 0xf27a1a, fin: 0xf27a1a, stripes: 3, stripeColor: 0xf5f5f5 },
  koi: { plan: 'fish', length: 0.6, body: 0xf5f2ea, belly: 0xf5f2ea, fin: 0xf5f2ea, spots: 6, spotColor: 0xe0501a },
  shark: { plan: 'fish', length: 3, height: 0.22, body: 0x6f7f8c, belly: 0xe8ecef, fin: 0x5f6f7c, dorsal: 2.2, pointy: true },
  whale: { plan: 'fish', length: 9, height: 0.26, width: 0.28, body: 0x2c3e5a, belly: 0xc8d0d8, fin: 0x22324a, fluke: true },
  dolphin: { plan: 'fish', length: 2.2, height: 0.2, body: 0x7f8c99, belly: 0xe0e6ea, fin: 0x6f7c89, fluke: true, beak: true, dorsal: 1.2 },
  piranha: { plan: 'fish', length: 0.25, height: 0.5, body: 0x7a8a8a, belly: 0xd8402a, fin: 0x5a6a6a },
  // serpents
  snake: { plan: 'serpent', length: 1.6, radius: 0.04, body: 0x4a7a2a, accent: 0x2a4a1a, bands: 10 },
  python: { plan: 'serpent', length: 3.5, radius: 0.09, body: 0xc8a86a, accent: 0x5a3a1a, bands: 18 },
  cobra: { plan: 'serpent', length: 2, radius: 0.05, body: 0x6a5a2a, accent: 0x2a2416, bands: 0, raised: true },
  worm: { plan: 'serpent', length: 0.25, radius: 0.012, body: 0xd88a8a, accent: 0xc87a7a, bands: 12, noEyes: true },
  eel: { plan: 'serpent', length: 1.4, radius: 0.05, body: 0x3a4a3a, accent: 0x6a7a5a, bands: 0 },
  // arthropods
  spider: { plan: 'arthropod', type: 'spider', size: 0.15, body: 0x1e1a18, accent: 0xc0201a },
  'giant spider': { plan: 'arthropod', type: 'spider', size: 1.4, body: 0x2a2420, accent: 0xc0201a },
  ant: { plan: 'arthropod', type: 'ant', size: 0.03, body: 0x2a1610, accent: 0x2a1610 },
  beetle: { plan: 'arthropod', type: 'beetle', size: 0.06, body: 0x1e4a3a, accent: 0x111111 },
  ladybug: { plan: 'arthropod', type: 'beetle', size: 0.02, body: 0xc0201a, accent: 0x111111, dots: true },
  scorpion: { plan: 'arthropod', type: 'scorpion', size: 0.15, body: 0x6a4a22, accent: 0x3a2412 },
  crab: { plan: 'arthropod', type: 'crab', size: 0.25, body: 0xd8401a, accent: 0xf0e0d0 },
};

// ---------- quadruped ----------
function makeQuadruped(THREE, M, p, main) {
  const v = p.vary ? rng(6007 + (p.variant ?? 0) * 7919) : null;
  const L = p.bodyLen ?? 0.75, BH = p.bodyH ?? 0.3, BW = p.bodyW ?? 0.25, LEG = p.legLen ?? 0.36;
  const tint = (c) => { const col = new THREE.Color(c); if (v) col.offsetHSL((v() - 0.5) * 0.04, (v() - 0.5) * 0.1, (v() - 0.5) * 0.16); return col.getHex(); };
  const mat = (c, r = 0.85, mt = 0, ex) => M(`q_${c.toString(16)}_${r}_${mt}${ex ? `_${Object.keys(ex).join('')}` : ''}`, { color: c, roughness: r, metalness: mt, ...ex });
  const coatC = tint(p.coat ?? 0xb07a45);
  const flat = p.woolly || p.scaly ? { flatShading: true } : undefined;
  const COAT = main || mat(coatC, p.woolly ? 1 : p.scaly ? 0.55 : 0.85, 0, flat);
  const BELLY = p.belly ? mat(p.belly, 0.9) : COAT;
  const ACC = mat(p.accent ?? 0x2a2420, 0.8, 0, flat);
  const HEADM = p.headColor ? mat(p.headColor, 0.85) : COAT;
  const HORN = mat(p.hornColor ?? 0xe8dcc0, 0.5);
  const DARK = mat(p.nose ?? 0x1a1414, 0.4);
  const S = (r = 1, w = 20, h = 14) => new THREE.SphereGeometry(r, w, h);
  const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };

  const root = new THREE.Group();
  const bodyY = LEG + BH * 0.42;
  const body = joint(root, 0, bodyY, 0);
  if (p.woolly) add(body, new THREE.IcosahedronGeometry(1, 2), COAT, 0, 0, 0, BW * 0.62, BH * 0.62, L * 0.55);
  else {
    const g = new THREE.CapsuleGeometry(0.5, 1, 8, 20); g.rotateX(Math.PI / 2);
    add(body, g, COAT, 0, 0, 0, BW, BH, L / 2);
    if (p.belly) add(body, S(), BELLY, 0, -BH * 0.16, 0, BW * 0.42, BH * 0.36, L * 0.4);
  }
  if (p.stripes) for (let i = 0; i < p.stripes; i++) {
    const z = -L * 0.42 + (i / (p.stripes - 1)) * L * 0.84;
    const k = Math.sqrt(Math.max(0.05, 1 - (Math.abs(z) / (L * 0.52)) ** 4));
    const ring = add(body, new THREE.TorusGeometry(1, 0.05, 6, 28, Math.PI * 1.2), ACC, 0, 0, z, BW * 0.505 * k, BH * 0.505 * k, 1);
    ring.rotation.z = -0.1 * Math.PI;
  }
  if (p.spots) { const r = rng(311); for (let i = 0; i < p.spots; i++) { const a = r() * Math.PI * 0.9 + 0.05 * Math.PI, z = (r() - 0.5) * L * 0.7; add(body, S(1, 10, 8), ACC, Math.cos(a) * BW * 0.48, Math.sin(a) * BH * 0.46, z, 0.02 + BW * 0.12, BH * 0.12, L * 0.08 + r() * L * 0.05); } }
  if (p.spikes && !p.saddle) for (let i = 0; i < 9; i++) add(body, new THREE.ConeGeometry(BH * 0.08, BH * 0.28, 5), ACC, 0, BH * 0.5, L * 0.4 - i * L * 0.1);
  if (p.saddle) {
    add(body, new THREE.CylinderGeometry(BW * 0.55, BW * 0.55, L * 0.3, 16, 1, false, -Math.PI / 2, Math.PI), mat(0x5a3418, 0.6), 0, BH * 0.38, L * 0.05, 1, 0.5, 1).rotation.x = Math.PI / 2;
  }
  root.userData.saddle = { node: body, y: BH * 0.5, z: L * 0.05 };

  // legs: [left-front, right-front, left-hind, right-hind]
  const LR = p.legR ?? BW * 0.14;
  const hipY = -BH * 0.12, reach = bodyY + hipY;
  const legs = [];
  for (const [sx, sz] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const front = sz > 0;
    const hip = joint(body, sx * BW * 0.3, hipY, sz * L * 0.36);
    const up = reach * 0.52, lo = reach * 0.44;
    add(hip, S(LR * 1.35, 12, 8), COAT, 0, 0, 0, 1, 1.3, 1.3);
    add(hip, new THREE.CylinderGeometry(LR * 1.25, LR, up, 12), COAT, 0, -up / 2, 0);
    const knee = joint(hip, 0, -up, 0);
    add(knee, S(LR, 10, 8), COAT);
    add(knee, new THREE.CylinderGeometry(LR, LR * 0.8, lo, 10), p.hooves && p.accent && p.socks ? ACC : COAT, 0, -lo / 2, 0);
    const foot = joint(knee, 0, -lo, 0);
    if (p.hooves) add(foot, new THREE.CylinderGeometry(LR * 0.85, LR, reach * 0.06, 10), DARK, 0, -reach * 0.03, 0);
    else add(foot, S(1, 10, 8), p.belly && p.plan !== 'none' ? COAT : COAT, 0, -reach * 0.02, LR * 0.4, LR * 1.1, LR * 0.7, LR * 1.5);
    const rest = { hip: front ? 0 : -0.12, knee: front ? 0 : 0.2 };
    legs.push({ hip, knee, front, rest, sx });
  }

  // neck + head
  const elev = p.neckAngle ?? 0.8, NL = p.neckLen ?? 0.2, NR = p.neckR ?? BH * 0.3;
  const neck = joint(body, 0, BH * 0.18, L * 0.42);
  neck.rotation.x = Math.PI / 2 - elev;
  add(neck, new THREE.CylinderGeometry(NR * 0.8, NR * 1.15, NL + NR, 14), COAT, 0, NL / 2, 0);
  if (p.mane) for (let i = 0; i < 8; i++) add(neck, new THREE.BoxGeometry(NR * 0.25, NR * 0.7, NL / 8 + NR * 0.1), ACC, 0, NL * (i / 8) + NR * 0.1, -NR * 0.85).rotation.x = 0.2;
  const head = joint(neck, 0, NL, 0);
  head.rotation.x = -(Math.PI / 2 - elev) + (p.headPitch ?? 0.15);
  const HL = p.headLen ?? 0.26, HH = p.headH ?? 0.17, HW = HH * 0.9;
  add(head, S(1, 24, 16), HEADM, 0, 0, HL * 0.1, HW * 0.62, HH * 0.6, HL * 0.42);
  const SN = p.snout ?? 0.1;
  if (SN > 0) {
    const sg = new THREE.CylinderGeometry(HH * (p.snoutFlat ? 0.4 : 0.3), HH * 0.42, SN, 14); sg.rotateX(Math.PI / 2);
    add(head, sg, HEADM, 0, -HH * 0.12, HL * 0.42 + SN / 2);
    add(head, S(HH * (p.snoutFlat ? 0.36 : 0.13), 12, 8), DARK, 0, -HH * (p.snoutFlat ? 0.12 : 0.05), HL * 0.42 + SN, 1, p.snoutFlat ? 0.8 : 0.8, p.snoutFlat ? 0.25 : 0.8);
  }
  const eyeC = mat(p.eye ?? 0x1a120c, 0.15);
  for (const s of [-1, 1]) {
    add(head, S(HH * 0.1, 12, 8), eyeC, s * HW * 0.5, HH * 0.18, HL * 0.32);
    add(head, S(HH * 0.03, 6, 4), mat(0xffffff, 0.1), s * HW * 0.53, HH * 0.24, HL * 0.38);
    const ES = p.earSize ?? 0.1;
    if (p.ears === 'pointy') { const e = add(head, new THREE.ConeGeometry(ES * 0.45, ES, 8), HEADM, s * HW * 0.35, HH * 0.6, HL * 0.02); e.rotation.z = s * -0.25; }
    else if (p.ears === 'floppy') { const e = add(head, S(1, 12, 8), ACC === COAT ? HEADM : mat(new THREE.Color(coatC).multiplyScalar(0.7).getHex()), s * HW * 0.62, HH * 0.1, 0, ES * 0.25, ES, ES * 0.6); e.rotation.z = s * 0.25; }
    else if (p.ears === 'round') add(head, S(1, 12, 8), HEADM, s * HW * 0.48, HH * 0.55, -HL * 0.05, ES, ES, ES * 0.4);
    else if (p.ears === 'side') { const e = add(head, S(1, 12, 8), HEADM, s * HW * 0.75, HH * 0.3, -HL * 0.05, ES, ES * 0.35, ES * 0.6); e.rotation.z = s * -0.3; }
    else if (p.ears === 'long') { const e = add(head, new THREE.CapsuleGeometry(ES * 0.2, ES, 4, 8), HEADM, s * HW * 0.25, HH * 0.6 + ES * 0.5, -HL * 0.1); e.rotation.z = s * -0.15; }
    else if (p.ears === 'big') { const e = add(head, S(1, 18, 12), COAT, s * HW * 0.8, HH * 0.05, -HL * 0.15, ES * 0.12, ES, ES * 0.85); e.rotation.y = s * 0.5; }
    if (p.horns === 'short') add(head, new THREE.ConeGeometry(HH * 0.08, HH * 0.4, 8), HORN, s * HW * 0.4, HH * 0.65, -HL * 0.05).rotation.z = s * -0.9;
    if (p.horns === 'curved') { const h = joint(head, s * HW * 0.35, HH * 0.5, -HL * 0.1); h.rotation.set(-0.9, 0, s * -0.4); add(h, new THREE.ConeGeometry(HH * 0.1, HH * 0.8, 8), HORN, 0, HH * 0.4, 0); }
    if (p.horns === 'antlers') { const a = joint(head, s * HW * 0.3, HH * 0.55, -HL * 0.05); a.rotation.z = s * -0.5; for (let i = 0; i < 3; i++) add(a, new THREE.CylinderGeometry(HH * 0.03, HH * 0.045, HH * 1.1, 6), HORN, s * i * HH * 0.18, HH * 0.5 + i * HH * 0.25, -i * HH * 0.1).rotation.z = i ? s * -0.8 : 0; }
    if (p.horns === 'ossicones') add(head, new THREE.CylinderGeometry(HH * 0.06, HH * 0.06, HH * 0.5, 8), ACC, s * HW * 0.2, HH * 0.75, -HL * 0.05);
    if (p.tusks) { const t = add(head, new THREE.ConeGeometry(HH * 0.06, HH * 0.8, 8), mat(0xf5f0e0, 0.4), s * HW * 0.25, -HH * 0.45, HL * 0.45); t.rotation.x = 2.2; }
  }
  if (p.horns === 'unicorn') { const h = add(head, new THREE.ConeGeometry(HH * 0.1, HH * 1.6, 12), mat(p.hornColor ?? 0xffd86b, 0.3, 0.6), 0, HH * 0.7, HL * 0.3); h.rotation.x = 0.55; }
  if (p.trunk) {
    let seg = head, len = HH * 0.5, r = HH * 0.22;
    const trunk = [];
    for (let i = 0; i < 5; i++) {
      seg = joint(seg, 0, i ? -len : -HH * 0.1, i ? 0 : HL * 0.45);
      seg.rotation.x = i ? 0.18 : -0.1;
      add(seg, new THREE.CylinderGeometry(r, r * 0.85, len, 12), COAT, 0, -len / 2, 0);
      trunk.push(seg);
      r *= 0.85;
    }
    root.userData.trunk = trunk;
  }
  if (p.lionMane) { const mn = add(neck, new THREE.IcosahedronGeometry(1, 1), mat(p.accent ?? 0x7a4a22, 1, 0, { flatShading: true }), 0, NL * 0.9, -HH * 0.1, HH * 1.1, HH * 1.0, HH * 0.9); mn.rotation.x = -(Math.PI / 2 - elev); }

  // tail
  const tail = joint(body, 0, BH * 0.2, -L * 0.48);
  tail.rotation.x = Math.PI / 2 + (p.tailUp ?? 0.3);
  const TL = p.tailLen ?? 0.3, tt = p.tail ?? 'thin';
  const tailSegs = [];
  if (tt === 'thin' || tt === 'tuft') { add(tail, new THREE.CylinderGeometry(BH * 0.04, BH * 0.07, TL, 8), COAT, 0, -TL / 2, 0); if (tt === 'tuft') add(tail, S(BH * 0.1, 10, 8), ACC, 0, -TL, 0, 1, 1.6, 1); }
  else if (tt === 'bushy') { add(tail, S(1, 14, 10), COAT, 0, -TL * 0.5, 0, BH * 0.22, TL * 0.55, BH * 0.22); if (p.tailTip) add(tail, S(BH * 0.16, 10, 8), mat(p.tailTip, 0.9), 0, -TL * 0.95, 0); }
  else if (tt === 'long') add(tail, new THREE.CylinderGeometry(BH * 0.07, BH * 0.16, TL, 8), ACC, 0, -TL / 2, 0);
  else if (tt === 'puff') add(tail, S(BH * 0.18, 12, 8), p.belly ? BELLY : COAT, 0, -BH * 0.05, 0);
  else if (tt === 'curl') add(tail, new THREE.TorusGeometry(BH * 0.08, BH * 0.025, 6, 12), COAT, 0, -BH * 0.1, 0);
  else if (tt === 'dragon') {
    let seg = tail, len = TL / 5, r = BH * 0.3;
    for (let i = 0; i < 5; i++) {
      seg = joint(seg, 0, i ? -len : 0, 0);
      add(seg, new THREE.CylinderGeometry(r, r * 0.72, len, 10), COAT, 0, -len / 2, 0);
      if (p.spikes) add(seg, new THREE.ConeGeometry(r * 0.3, r * 0.9, 5), ACC, 0, -len / 2, -r * 0.8).rotation.x = -Math.PI / 2;
      tailSegs.push(seg);
      r *= 0.72;
    }
    if (p.wings) add(seg, new THREE.ConeGeometry(BH * 0.12, BH * 0.3, 4), ACC, 0, -len - BH * 0.1, 0).rotation.x = Math.PI;
  }

  // wings
  const wings = [];
  if (p.wings) {
    const span = p.wingSpan ?? 2;
    const WM = p.wings === 'membrane' ? mat(p.accent ?? 0x1d4f33, 0.7, 0, { side: THREE.DoubleSide }) : mat(p.coat ?? 0xf6f6f6, 0.9, 0, { side: THREE.DoubleSide });
    for (const s of [1, -1]) {
      const w = joint(body, s * BW * 0.35, BH * 0.38, L * 0.15);
      const sh = new THREE.Shape();
      sh.moveTo(0, 0); sh.lineTo(span * 0.35, span * 0.18); sh.lineTo(span, span * 0.05);
      if (p.wings === 'membrane') { sh.lineTo(span * 0.75, -span * 0.2); sh.lineTo(span * 0.5, -span * 0.12); sh.lineTo(span * 0.3, -span * 0.3); }
      else { sh.lineTo(span * 0.8, -span * 0.22); sh.lineTo(span * 0.45, -span * 0.3); }
      sh.lineTo(0, -L * 0.3); sh.lineTo(0, 0);
      const g = new THREE.ShapeGeometry(sh); g.rotateX(-Math.PI / 2);
      const m = add(w, g, WM); m.scale.x = s;
      m.userData.keep = true;
      if (p.wings === 'membrane') { const bone = add(w, new THREE.CylinderGeometry(BH * 0.04, BH * 0.06, span, 6), ACC, s * span / 2, 0, -span * 0.08); bone.rotation.set(0, s * 0.05, Math.PI / 2); }
      wings.push({ w, s });
    }
  }

  mergeParts(root);

  // ---- rig: idle / walk / run / fly ----
  root.userData.rig = (t, mode) => {
    const walk = mode === 'walk' || mode === 'run', run = mode === 'run', fly = mode === 'fly' && wings.length;
    const ph = t * (run ? 9 : 5.5), A = run ? 0.65 : 0.38;
    const offs = run ? [0, 0.5, Math.PI, Math.PI + 0.5] : [0, Math.PI, Math.PI, 0];
    legs.forEach((l, i) => {
      l.hip.rotation.x = l.rest.hip + (walk ? Math.sin(ph + offs[i]) * A : 0) + (fly ? (l.front ? -0.7 : 0.7) : 0);
      l.knee.rotation.x = l.rest.knee + (walk ? Math.max(0, -Math.cos(ph + offs[i])) * A * 1.2 : 0) + (fly ? 0.9 : 0);
    });
    body.position.y = bodyY + (walk ? Math.abs(Math.sin(ph)) * BH * (run ? 0.12 : 0.04) : Math.sin(t * 1.4) * BH * 0.01);
    body.rotation.x = run ? Math.sin(ph * 2) * 0.04 : 0;
    neck.rotation.x = Math.PI / 2 - elev + (walk ? Math.sin(ph * 2) * 0.04 : Math.sin(t * 0.6) * 0.05);
    head.rotation.y = walk ? 0 : Math.sin(t * 0.45) * 0.35;
    tail.rotation.y = Math.sin(t * (walk ? 7 : 3)) * (tt === 'long' ? 0.12 : 0.35);
    tailSegs.forEach((s, i) => { s.rotation.y = Math.sin(t * 2 - i * 0.6) * 0.12; });
    wings.forEach(({ w, s }) => { w.rotation.z = fly ? s * Math.sin(t * 6) * 0.75 : s * 0.5; w.rotation.y = fly ? 0 : s * 0.55; });
    (root.userData.trunk || []).forEach((s, i) => { s.rotation.x = (i ? 0.18 : -0.1) + Math.sin(t * 1.3 - i * 0.5) * 0.1; });
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------- bird ----------
function makeBird(THREE, M, p, main) {
  const s = p.size ?? 0.2, up = p.upright ?? 0;
  const mat = (c, r = 0.8, ex) => M(`b_${c.toString(16)}_${r}${ex ? '_ds' : ''}`, { color: c, roughness: r, ...ex });
  const BODY = main || mat(p.body ?? 0x3d77c2), BELLY = mat(p.belly ?? 0xf2e6d0), WING = mat(p.wing ?? p.body ?? 0x2a5aa0), HEAD = p.head ? mat(p.head) : BODY;
  const BEAK = mat(p.beak ?? 0xf2b230, 0.5), LEGS = mat(p.legs ?? 0xe08a30, 0.6);
  const S = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
  const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const root = new THREE.Group();
  const legLen = s * 0.35 * (p.legLen ?? 1);
  const body = joint(root, 0, legLen + s * 0.32, 0);
  body.rotation.x = -up * 1.2;
  add(body, S(1, 22, 16), BODY, 0, 0, 0, s * 0.33, s * 0.33, s * 0.55);
  add(body, S(1, 18, 12), BELLY, 0, -s * 0.06, s * 0.08, s * 0.28, s * 0.27, s * 0.42);
  const tail = add(body, new THREE.BoxGeometry(s * 0.3, s * 0.03, s * 0.4 * (p.tailLen ?? 1) * 1.4), WING, 0, s * 0.08, -s * 0.6 * (p.tailLen ?? 1));
  tail.rotation.x = 0.35;
  // neck + head
  const neckLen = s * 0.15 * (p.neckLen ?? 1);
  const neck = joint(body, 0, s * 0.22, s * 0.35);
  neck.rotation.x = up * 1.2;
  if (p.neckLen) add(neck, new THREE.CylinderGeometry(s * 0.06, s * 0.08, neckLen, 8), BODY, 0, neckLen / 2, 0);
  const head = joint(neck, 0, neckLen + s * 0.05, 0);
  add(head, S(s * 0.2, 18, 12), HEAD, 0, s * 0.05, 0);
  const beakLen = s * (p.beakFlat ? 0.24 : p.beakHook ? 0.2 : 0.18);
  const bk = add(head, new THREE.ConeGeometry(s * (p.beakFlat ? 0.08 : 0.06), beakLen, 10), BEAK, 0, s * 0.02, s * 0.18 + beakLen / 2, 1, 1, p.beakFlat ? 0.4 : 1);
  bk.rotation.x = Math.PI / 2 + (p.beakHook ? 0.35 : 0);
  if (p.beakFlat) bk.scale.set(1.4, 1, 0.45);
  const ES = p.bigEyes ? 2.2 : 1;
  for (const k of [-1, 1]) {
    if (p.bigEyes) add(head, S(s * 0.07, 12, 8), mat(0xf5f0e6, 0.5), k * s * 0.08, s * 0.08, s * 0.14);
    add(head, S(s * 0.032 * ES, 10, 8), mat(p.eye ?? 0x111111, 0.2), k * s * (p.bigEyes ? 0.08 : 0.13), s * 0.09, s * (p.bigEyes ? 0.18 : 0.1));
    if (p.ears) add(head, new THREE.ConeGeometry(s * 0.04, s * 0.14, 6), BODY, k * s * 0.12, s * 0.26, -s * 0.02).rotation.z = k * -0.3;
  }
  if (p.comb) add(head, S(1, 10, 8), mat(0xd0201a, 0.6), 0, s * 0.24, s * 0.02, s * 0.03, s * 0.08, s * 0.12);
  // wings
  const wings = [];
  for (const k of [1, -1]) {
    const w = joint(body, k * s * 0.3, s * 0.12, s * 0.05);
    add(w, S(1, 14, 10), WING, k * s * (p.flightless ? 0.03 : 0.26), 0, -s * 0.1, s * (p.flightless ? 0.06 : 0.3), s * 0.035, s * (p.flightless ? 0.35 : 0.36));
    wings.push({ w, k });
  }
  // legs
  const legs = [];
  for (const k of [1, -1]) {
    const l = joint(root, k * s * 0.1, legLen + s * 0.1, 0);
    add(l, new THREE.CylinderGeometry(s * 0.02, s * 0.02, legLen + s * 0.1, 6), LEGS, 0, -(legLen + s * 0.1) / 2, 0);
    for (const a of [-0.5, 0, 0.5]) { const toe = add(l, new THREE.BoxGeometry(s * 0.02, s * 0.015, s * 0.14), LEGS, Math.sin(a) * s * 0.05, -(legLen + s * 0.1), Math.cos(a) * s * 0.06); toe.rotation.y = a; }
    legs.push(l);
  }
  mergeParts(root);
  const baseY = body.position.y;
  root.userData.rig = (t, mode) => {
    const fly = mode === 'fly' && !p.flightless, walk = mode === 'walk' || mode === 'run';
    // folded down along the body at rest; spread and flapping in flight
    wings.forEach(({ w, k }) => { w.rotation.z = fly ? k * Math.sin(t * 14) * 0.8 : -k * (p.flightless ? 0.15 - (walk ? Math.sin(t * 8) * 0.25 : 0) : 1.35); });
    legs.forEach((l, i) => { l.rotation.x = fly ? 0.9 : walk ? Math.sin(t * 8 + i * Math.PI) * 0.5 : 0; });
    body.position.y = baseY + (fly ? Math.sin(t * 14) * s * 0.03 : walk ? Math.abs(Math.sin(t * 8)) * s * 0.04 : 0);
    body.rotation.z = p.flightless && walk ? Math.sin(t * 8) * 0.12 : 0;
    head.rotation.x = fly ? -0.2 : Math.max(0, Math.sin(t * 2.3)) ** 8 * 0.6;
    head.rotation.y = fly ? 0 : Math.sin(t * 0.9) * 0.6;
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------- fish ----------
function makeFish(THREE, M, p, main) {
  const L = p.length ?? 0.4, Hh = (p.height ?? 0.35) * L, W = (p.width ?? 0.16) * L;
  const mat = (c, r = 0.45, ex) => M(`f_${c.toString(16)}_${r}${ex ? '_ds' : ''}`, { color: c, roughness: r, metalness: 0.1, ...ex });
  const BODY = main || mat(p.body ?? 0xf28c28), BELLY = mat(p.belly ?? 0xf5c87a), FIN = mat(p.fin ?? 0xf2a85a, 0.6, { side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
  const S = (r = 1, w = 24, h = 16) => new THREE.SphereGeometry(r, w, h);
  const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const tri = (pts) => { const sh = new THREE.Shape(); sh.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(([x, y]) => sh.lineTo(x, y)); return new THREE.ShapeGeometry(sh); };
  const root = new THREE.Group();
  const body = joint(root, 0, Hh * 0.6, 0);
  add(body, S(), BODY, 0, 0, L * 0.05, W / 2, Hh / 2, L * (p.pointy ? 0.42 : 0.36));
  add(body, S(1, 18, 12), BELLY, 0, -Hh * 0.12, L * 0.05, W * 0.44, Hh * 0.36, L * 0.32);
  if (p.beak) { const b = add(body, new THREE.CylinderGeometry(Hh * 0.08, Hh * 0.18, L * 0.12, 10), BODY, 0, -Hh * 0.08, L * 0.44); b.rotation.x = Math.PI / 2; }
  if (p.stripes) for (let i = 0; i < p.stripes; i++) add(body, new THREE.TorusGeometry(1, 0.08, 6, 24), mat(p.stripeColor ?? 0xffffff, 0.4), 0, 0, L * (0.25 - i * 0.22), W * 0.5, Hh * 0.5 * (1 - i * 0.12), 1).rotation.y = Math.PI / 2 * 0;
  if (p.spots) { const r = rng(77); for (let i = 0; i < p.spots; i++) add(body, S(1, 10, 8), mat(p.spotColor ?? 0xe0501a, 0.4), (r() > 0.5 ? 1 : -1) * W * 0.42, (r() - 0.3) * Hh * 0.5, (r() - 0.5) * L * 0.5, W * 0.12, Hh * 0.18, L * 0.1); }
  for (const k of [-1, 1]) {
    add(body, S(Hh * 0.07, 12, 8), mat(0x0a0a0a, 0.1), k * W * 0.42, Hh * 0.12, L * 0.3);
    const pf = add(body, tri([[0, 0], [L * 0.14, -Hh * 0.1], [L * 0.1, Hh * 0.08]]), FIN, k * W * 0.45, -Hh * 0.12, L * 0.18);
    pf.rotation.y = k * -Math.PI / 2 - 0.4 * k;
  }
  const dorsal = add(body, tri([[0, 0], [-L * 0.12, Hh * 0.35 * (p.dorsal ?? 1)], [-L * 0.25, 0]]), FIN, 0, Hh * 0.42, L * 0.12);
  dorsal.rotation.y = -Math.PI / 2;
  const tail = joint(body, 0, 0, -L * 0.28);
  add(tail, S(1, 16, 10), BODY, 0, 0, -L * 0.08, W * 0.3, Hh * 0.28, L * 0.14);
  const TS = p.tailSize ?? 1;
  const fin = add(tail, tri(p.pointy ? [[0, 0], [-L * 0.25, Hh * 0.75], [-L * 0.14, 0], [-L * 0.2, -Hh * 0.4]] : [[0, 0], [-L * 0.2 * TS, Hh * 0.45 * TS], [-L * 0.13 * TS, 0], [-L * 0.2 * TS, -Hh * 0.45 * TS]]), FIN, 0, 0, -L * 0.18);
  fin.rotation.y = -Math.PI / 2;
  if (p.fluke) fin.rotation.z = Math.PI / 2;
  mergeParts(root);
  root.userData.rig = (t, mode) => {
    const f = mode === 'swim' ? 7 : 2.5, a = mode === 'swim' ? 0.4 : 0.15;
    if (p.fluke) { tail.rotation.x = Math.sin(t * f * 0.6) * a; body.rotation.x = -Math.sin(t * f * 0.6) * a * 0.15; }
    else { tail.rotation.y = Math.sin(t * f) * a; body.rotation.y = -Math.sin(t * f) * a * 0.15; }
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------- serpent (one deforming mesh, 1-2 draw calls) ----------
function makeSerpent(THREE, M, p, main) {
  const L = p.length ?? 1.6, R = p.radius ?? 0.04, N = 64;
  const geo = new THREE.CylinderGeometry(1, 1, L, 12, N, true);
  geo.rotateX(Math.PI / 2);
  const pos = geo.attributes.position, base = pos.array.slice();
  const col = new THREE.Color(), c1 = new THREE.Color(p.body ?? 0x4a7a2a), c2 = new THREE.Color(p.accent ?? 0x2a4a1a), colors = [];
  for (let i = 0; i < pos.count; i++) {
    const u = 0.5 - base[i * 3 + 2] / L; // 0 head .. 1 tail
    const band = p.bands && Math.sin(u * p.bands * Math.PI * 2) > 0.6;
    col.copy(band ? c2 : c1); if (base[i * 3 + 1] < 0) col.lerp(new THREE.Color(0xe8dcb8), 0.25);
    colors.push(col.r, col.g, col.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  const body = new THREE.Mesh(geo, main || M(`snake_vc`, { vertexColors: true, roughness: 0.45 }));
  const root = new THREE.Group();
  root.add(body);
  const head = new THREE.Group();
  const hm = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), M(`s_${(p.body ?? 0x4a7a2a).toString(16)}`, { color: p.body ?? 0x4a7a2a, roughness: 0.45 }));
  hm.scale.set(R * 1.5, R * 1.1, R * 2.3);
  head.add(hm);
  if (!p.noEyes) for (const k of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(R * 0.32, 8, 6), M('s_eye', { color: 0xf2c230, roughness: 0.1 })); e.position.set(k * R * 1.05, R * 0.45, R * 0.9); head.add(e); }
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(R * 0.15, R * 0.05, R * 1.4), M('s_tongue', { color: 0xc0201a, roughness: 0.5 }));
  tongue.position.set(0, -R * 0.2, R * 2.6);
  if (!p.noEyes) head.add(tongue);
  root.add(head);
  const path = (u, t) => Math.sin(u * 9 - t * 3) * L * 0.07 * Math.min(1, u * 3 + 0.2);
  root.userData.rig = (t, mode) => {
    const tt = mode === 'slither' || mode === 'walk' || mode === 'swim' ? t : t * 0.25;
    for (let i = 0; i < pos.count; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1], bz = base[i * 3 + 2];
      const u = 0.5 - bz / L;
      const taper = R * (u < 0.05 ? 0.8 + u * 4 : Math.max(0.12, 1 - Math.max(0, u - 0.55) * 2));
      const lift = p.raised && u < 0.25 ? (0.25 - u) * L * 0.9 : 0;
      pos.setXYZ(i, bx * taper + path(u, tt), by * taper + R + lift, bz);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    head.position.set(path(0, tt), R + (p.raised ? L * 0.22 : 0), L / 2 + R);
    tongue.visible = Math.sin(t * 5) > 0.6;
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------- arthropod: spider, ant, beetle, scorpion, crab ----------
function makeArthropod(THREE, M, p, main) {
  const s = p.size ?? 0.15, type = p.type ?? 'spider';
  const mat = (c, r = 0.5) => M(`a_${c.toString(16)}_${r}`, { color: c, roughness: r, metalness: 0.15 });
  const BODY = main || mat(p.body ?? 0x1e1a18, type === 'beetle' ? 0.25 : 0.55), ACC = mat(p.accent ?? 0xc0201a);
  const S = (r = 1, w = 18, h = 12) => new THREE.SphereGeometry(r, w, h);
  const add = (parent, geo, material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1) => { const m = new THREE.Mesh(geo, material); m.position.set(x, y, z); m.scale.set(sx, sy, sz); parent.add(m); return m; };
  const joint = (parent, x, y, z) => { const j = new THREE.Group(); j.position.set(x, y, z); parent.add(j); return j; };
  const root = new THREE.Group();
  const body = joint(root, 0, s * 0.45, 0);
  const nLegs = type === 'spider' ? 8 : type === 'crab' ? 8 : 6;
  if (type === 'spider') { add(body, S(), BODY, 0, 0, s * 0.25, s * 0.3, s * 0.25, s * 0.32); add(body, S(), BODY, 0, s * 0.12, -s * 0.35, s * 0.45, s * 0.4, s * 0.55); add(body, S(1, 10, 8), ACC, 0, s * 0.4, -s * 0.4, s * 0.12, s * 0.06, s * 0.2); for (let i = 0; i < 4; i++) add(body, S(s * 0.04, 8, 6), ACC, (i - 1.5) * s * 0.06, s * 0.12, s * 0.55); }
  else if (type === 'ant') { add(body, S(), BODY, 0, s * 0.1, s * 0.55, s * 0.25, s * 0.22, s * 0.25); add(body, S(), BODY, 0, 0, s * 0.15, s * 0.16, s * 0.16, s * 0.28); add(body, S(), BODY, 0, s * 0.1, -s * 0.5, s * 0.32, s * 0.3, s * 0.45); for (const k of [-1, 1]) add(body, new THREE.CylinderGeometry(s * 0.015, s * 0.015, s * 0.5, 5), BODY, k * s * 0.12, s * 0.4, s * 0.75).rotation.set(0.6, 0, k * -0.4); }
  else if (type === 'beetle') { add(body, new THREE.SphereGeometry(1, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), BODY, 0, -s * 0.05, -s * 0.05, s * 0.45, s * 0.42, s * 0.6); add(body, S(), ACC, 0, 0, s * 0.55, s * 0.2, s * 0.15, s * 0.18); add(body, new THREE.BoxGeometry(s * 0.01, s * 0.3, s * 1.1), ACC, 0, s * 0.23, -s * 0.05); if (p.dots) { for (const [x, z] of [[0.18, 0.15], [-0.18, 0.15], [0.22, -0.2], [-0.22, -0.2], [0.1, -0.4], [-0.1, -0.4]]) add(body, S(s * 0.07, 10, 6), ACC, x * s, s * 0.32, z * s); } }
  else if (type === 'scorpion' || type === 'crab') {
    add(body, S(), BODY, 0, 0, 0, s * (type === 'crab' ? 0.6 : 0.32), s * 0.2, s * (type === 'crab' ? 0.45 : 0.55));
    for (const k of [-1, 1]) { const arm = joint(body, k * s * (type === 'crab' ? 0.55 : 0.25), 0, s * 0.45); arm.rotation.y = k * 0.5; add(arm, new THREE.CylinderGeometry(s * 0.05, s * 0.05, s * 0.5, 6), BODY, 0, 0, s * 0.25).rotation.x = Math.PI / 2; add(arm, S(1, 12, 8), BODY, 0, 0, s * 0.6, s * 0.14, s * 0.1, s * 0.2); }
    if (type === 'scorpion') { let seg = joint(body, 0, s * 0.05, -s * 0.5); for (let i = 0; i < 5; i++) { seg = joint(seg, 0, i ? s * 0.2 : 0, i ? 0 : 0); seg.rotation.x = -0.55; add(seg, S(s * 0.09, 10, 8), BODY, 0, s * 0.1, 0); } add(seg, new THREE.ConeGeometry(s * 0.05, s * 0.2, 6), ACC, 0, s * 0.3, s * 0.05).rotation.x = 0.8; }
    if (type === 'crab') for (const k of [-1, 1]) { add(body, new THREE.CylinderGeometry(s * 0.02, s * 0.02, s * 0.2, 5), BODY, k * s * 0.15, s * 0.25, s * 0.35); add(body, S(s * 0.05, 8, 6), mat(0x111111), k * s * 0.15, s * 0.36, s * 0.35); }
  }
  const legs = [];
  const per = nLegs / 2;
  for (const k of [1, -1]) for (let i = 0; i < per; i++) {
    const z = (per === 1 ? 0 : (0.5 - i / (per - 1))) * s * (type === 'spider' ? 0.5 : 0.6) + (type === 'spider' ? s * 0.22 : type === 'ant' ? s * 0.15 : 0);
    const hip = joint(body, k * s * 0.2, 0, z);
    hip.rotation.y = k * (Math.PI / 2) + (i - (per - 1) / 2) * -0.45 * k;
    const len = s * (type === 'spider' ? 0.7 : type === 'crab' ? 0.55 : 0.4);
    const up = joint(hip, 0, 0, 0); up.rotation.x = -0.7;
    add(up, new THREE.CylinderGeometry(s * 0.025, s * 0.03, len, 5), BODY, 0, 0, len / 2).rotation.x = Math.PI / 2;
    const knee = joint(up, 0, 0, len); knee.rotation.x = 1.6;
    add(knee, new THREE.CylinderGeometry(s * 0.015, s * 0.025, len * 1.1, 5), BODY, 0, 0, len * 0.55).rotation.x = Math.PI / 2;
    legs.push({ hip, base: hip.rotation.y, i, k });
  }
  mergeParts(root);
  const baseY = body.position.y;
  root.userData.rig = (t, mode) => {
    const walk = mode === 'walk' || mode === 'run';
    legs.forEach(({ hip, base, i, k }) => { hip.rotation.y = base + (walk ? Math.sin(t * 10 + (i + (k > 0 ? 0 : 1)) * Math.PI) * 0.3 : Math.sin(t * 1.5 + i) * 0.03); });
    body.position.y = baseY + (walk ? Math.abs(Math.sin(t * 10)) * s * 0.03 : 0);
  };
  root.userData.rig(0, 'idle');
  return root;
}

export const CREATURE_FACTORIES = { quadruped: makeQuadruped, bird: makeBird, fish: makeFish, serpent: makeSerpent, arthropod: makeArthropod };
