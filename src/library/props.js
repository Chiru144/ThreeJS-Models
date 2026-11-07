// Realistic environment props (sculpted, painted): rocks and trees.
/* eslint-disable no-undef */

function makeRockReal(THREE, M, p, main) {
  const sz = p.size ?? 0.8, seed = p.seed ?? 7, r = rng(seed * 97 + 13);
  const nodes = [{ s: ['e', 0, sz * 0.22, 0, sz, sz * 0.6, sz * 0.82] }];
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2;
    nodes.push({ s: ['e', Math.cos(a) * sz * 0.5, sz * (0.12 + r() * 0.3), Math.sin(a) * sz * 0.42, sz * (0.35 + r() * 0.3), sz * (0.22 + r() * 0.25), sz * (0.3 + r() * 0.3)], k: sz * 0.25, rot: [r() - 0.5, r() * 3, r() - 0.5] });
  }
  // fractured facets: a few cutting planes, then ground contact
  for (let i = 0; i < 5; i++) {
    const a = r() * Math.PI * 2, el = r() * 0.9;
    const n = [Math.cos(a) * Math.cos(el), Math.sin(el), Math.sin(a) * Math.cos(el)];
    nodes.push({ s: ['p', ...n, sz * (0.5 + r() * 0.25) + n[1] * sz * 0.2], op: 'i', k: sz * 0.04 });
  }
  nodes.push({ s: ['p', 0, -1, 0, sz * 0.08], op: 'i', k: sz * 0.05 });
  const grp = [{ g: nodes, n: [sz * 0.025, 9 / sz, 'n'] }];
  const h = (x, y, z) => { const q = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return q - Math.floor(q); };
  const base = new THREE.Color(p.color ?? 0x8a8580);
  const paint = (x, y, z, c, n) => {
    const grain = 0.88 + 0.22 * h(Math.floor(x / sz * 30), Math.floor(y / sz * 30), Math.floor(z / sz * 30)) * 0.5 + 0.1 * Math.sin(x / sz * 7 + z / sz * 3);
    let col = base.clone().multiplyScalar(grain);
    const lich = Math.sin(x / sz * 9.1) * Math.sin(z / sz * 8.3 + y / sz * 3) + Math.sin(x / sz * 23 + z / sz * 19) * 0.4;
    if (n[1] > 0.35 && lich > 0.55) col.lerp(new THREE.Color(0x8a9a4a), 0.6);
    c[0] *= col.r; c[1] *= col.g; c[2] *= col.b;
  };
  const cache = (sculpt.cache ||= new Map());
  const key = JSON.stringify(['rock', sz, seed, p.color, p.lod]);
  let geo = cache.get(key);
  if (!geo) { geo = sculpt(grp, { cell: sz * (p.lod === 'low' ? 0.07 : 0.035), ao: 1.2, paint }); cache.set(key, geo); }
  return new THREE.Mesh(geo, main || M('rock_real', { color: 0xffffff, roughness: 0.92, vertexColors: true }, 'MeshPhysicalMaterial'));
}

function makeTreeReal(THREE, M, p, main) {
  const h = p.height ?? 3, style = p.style ?? 'pine', seed = p.seed ?? 3, r = rng(seed * 31 + (style === 'pine' ? 1 : 2));
  const bark = [], leaves = [];
  const trunkTop = style === 'pine' ? h * 0.97 : h * 0.62;
  bark.push({ s: ['rc', 0, 0, 0, 0, trunkTop, 0, h * 0.045, h * 0.012], n: [h * 0.003, 70 / h, 'vgroove'] });
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2 + r(); bark.push({ s: ['rc', 0, h * 0.06, 0, Math.cos(a) * h * 0.09, -h * 0.01, Math.sin(a) * h * 0.09, h * 0.028, h * 0.01], k: h * 0.04 }); }
  if (style === 'pine') {
    const layers = 7;
    // drooping whorls of branches: each a flattened, downward-curving cone with needle clumps
    for (let i = 0; i < layers; i++) {
      const t = i / (layers - 1), y = h * (0.2 + t * 0.68), rad = h * (0.29 - t * 0.22) * (0.9 + r() * 0.2);
      leaves.push({ s: ['rc', 0, y - h * 0.02, 0, 0, y + h * 0.16, 0, rad, rad * 0.08], k: h * 0.03, n: [rad * 0.035, 22 / rad, 'curl'] });
    }
    leaves.push({ s: ['rc', 0, h * 0.85, 0, 0, h * 1.02, 0, h * 0.06, h * 0.005], k: h * 0.03 });
  } else {
    const crownY = h * 0.68, CR = h * 0.36;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + r() * 0.8, end = [Math.cos(a) * CR * 0.65, crownY + h * (0.05 + r() * 0.12), Math.sin(a) * CR * 0.65];
      bark.push({ s: ['rc', 0, h * 0.5, 0, ...end, h * 0.022, h * 0.008], k: h * 0.03 });
    }
    for (let i = 0; i < 11; i++) {
      const a = r() * Math.PI * 2, el = (r() - 0.25) * 1.2, d = CR * (0.35 + r() * 0.5);
      const c = [Math.cos(a) * Math.cos(el) * d, crownY + Math.sin(el) * d * 0.8 + h * 0.06, Math.sin(a) * Math.cos(el) * d];
      leaves.push({ s: ['s', ...c, CR * (0.38 + r() * 0.22)], k: CR * 0.25, n: [CR * 0.045, 11 / CR, 'curl'] });
    }
    leaves.push({ s: ['p', 0, -1, 0, -(crownY - CR * 0.55)], op: 'i', k: CR * 0.2 });
  }
  const pine = style === 'pine';
  const leafC = new THREE.Color(main?.color ?? (pine ? 0x1f4a24 : 0x3f6a24));
  const paintLeaf = (x, y, z, c, n) => {
    const tip = Math.max(0, n[1]) * 0.25 + 0.85;
    const vary = 0.85 + 0.3 * (Math.sin(x * 7 / h * 3 + z * 5) * Math.sin(y * 9 / h * 3) * 0.5 + 0.5);
    const col = leafC.clone().multiplyScalar(tip * vary);
    if (!pine) col.offsetHSL(Math.sin(x * 3 + z * 2) * 0.02, 0, 0);
    c[0] *= col.r; c[1] *= col.g; c[2] *= col.b;
  };
  const barkC = new THREE.Color(pine ? 0x4a3424 : 0x5a4a3a);
  const paintBark = (x, y, z, c) => { const k = 0.8 + 0.3 * Math.abs(Math.sin(Math.atan2(x, z) * 9 + y * 12 / h)); c[0] *= barkC.r * k; c[1] *= barkC.g * k; c[2] *= barkC.b * k; };
  const cache = (sculpt.cache ||= new Map());
  const cell = h * (p.lod === 'low' ? 0.035 : 0.018);
  const build = (nodes, tag, paint, ao) => { const key = JSON.stringify(['tree', tag, h, style, seed, p.lod, leafC.getHex()]); let g = cache.get(key); if (!g) { g = sculpt(nodes, { cell, ao, paint }); cache.set(key, g); } return g; };
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(build(bark, 'bark', paintBark, 1), M('tree_bark', { color: 0xffffff, roughness: 0.95, vertexColors: true }, 'MeshPhysicalMaterial')));
  grp.add(new THREE.Mesh(build(leaves, 'leaves', paintLeaf, 1.4), M('tree_leaves', { color: 0xffffff, roughness: 0.78, sheen: 0.25, sheenColor: 0x6f9f3a, vertexColors: true }, 'MeshPhysicalMaterial')));
  return grp;
}

export const REAL_PROPS = { rock: makeRockReal, tree: makeTreeReal };
