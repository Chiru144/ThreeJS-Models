// Runtime helpers that get copied (via Function#toString) into generated scenes.
// They must be self-contained: only use their arguments, THREE and each other.
/* eslint-disable no-undef */

export function rng(seed) {
  // mulberry32: tiny, fast, deterministic
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function scatter(count, inner, outer, minDist, seed, occupied, yJitter) {
  // Rejection-sampled annulus scatter. Returns [x, y, z, rotY, scale][].
  const r = rng(seed);
  const out = [];
  let tries = 0;
  while (out.length < count && tries < count * 60) {
    tries++;
    const ang = r() * Math.PI * 2;
    const rad = Math.sqrt(inner * inner + r() * (outer * outer - inner * inner));
    const x = Math.cos(ang) * rad;
    const z = Math.sin(ang) * rad;
    let ok = true;
    for (let i = 0; i < occupied.length && ok; i++) {
      const o = occupied[i];
      const dx = o[0] - x, dz = o[1] - z, md = Math.max(minDist, o[2]);
      if (dx * dx + dz * dz < md * md) ok = false;
    }
    if (!ok) continue;
    occupied.push([x, z, minDist]);
    const y = yJitter ? (r() - 0.5) * yJitter : heightAt(x, z);
    out.push([x, y, z, r() * Math.PI * 2, 0.8 + r() * 0.4]);
  }
  return out;
}

export function instanceize(template, transforms) {
  // Collapse N copies of a (multi-part) template into one InstancedMesh per part.
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const p = new THREE.Vector3(), s = new THREE.Vector3();
  const mats = transforms.map(([x, y, z, ry, sc]) =>
    new THREE.Matrix4().compose(p.set(x, y, z), q.setFromEuler(e.set(0, ry, 0)), s.set(sc, sc, sc)));
  template.updateMatrixWorld(true);
  template.traverse((o) => {
    if (!o.isMesh) return;
    const im = new THREE.InstancedMesh(o.geometry, o.material, mats.length);
    for (let i = 0; i < mats.length; i++) im.setMatrixAt(i, m.multiplyMatrices(mats[i], o.matrixWorld));
    im.instanceMatrix.needsUpdate = true;
    im.computeBoundingSphere();
    im.userData = { ...o.userData };
    group.add(im);
  });
  return group;
}

export function heightAt(x, z) {
  // Smooth procedural height field shared by the terrain mesh and object placement.
  // TERRAIN = { amp, flats: [[x, z, radius, depth]] } is declared by the generated scene;
  // flats keep the hero area level and carve basins under water.
  if (!TERRAIN.amp) return 0;
  let k = 1, dip = 0;
  for (const [cx, cz, r, d] of TERRAIN.flats) {
    const t = Math.min(1, Math.max(0, (Math.hypot(x - cx, z - cz) - r) / Math.max(r * 0.6, 2)));
    const s = t * t * (3 - 2 * t);
    k = Math.min(k, s);
    if (d) dip = Math.min(dip, -d * (1 - s));
  }
  const h = Math.sin(x * 0.08 + 1.3) * Math.cos(z * 0.07 + 0.4) + 0.5 * Math.sin(x * 0.17 + z * 0.13 + 2.1) + 0.25 * Math.cos(x * 0.31 - z * 0.27);
  return TERRAIN.amp * (h + 0.6) * k + dip;
}

export function mergeParts(root) {
  // Merge sibling meshes that share a material inside each joint group. Joints stay
  // separate (so rigs still animate) while draw calls drop from ~60 to ~15 per character.
  const groups = [];
  root.traverse((o) => { if (o.isGroup || o === root) groups.push(o); });
  for (const g of groups) {
    const buckets = new Map();
    for (const c of g.children) {
      if (!c.isMesh || c.isInstancedMesh || c.children.length || c.userData.keep) continue;
      if (!buckets.has(c.material)) buckets.set(c.material, []);
      buckets.get(c.material).push(c);
    }
    for (const [material, list] of buckets) {
      if (list.length < 2) continue;
      const pos = [], nor = [], idx = [];
      let base = 0;
      for (const m of list) {
        m.updateMatrix();
        const geo = m.geometry.clone().applyMatrix4(m.matrix);
        const P = geo.attributes.position, N = geo.attributes.normal;
        for (let i = 0; i < P.count; i++) { pos.push(P.getX(i), P.getY(i), P.getZ(i)); nor.push(N.getX(i), N.getY(i), N.getZ(i)); }
        if (geo.index) for (let i = 0; i < geo.index.count; i++) idx.push(geo.index.getX(i) + base);
        else for (let i = 0; i < P.count; i++) idx.push(i + base);
        base += P.count;
        geo.dispose();
        g.remove(m);
      }
      const merged = new THREE.BufferGeometry();
      merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      merged.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
      merged.setIndex(idx);
      const mesh = new THREE.Mesh(merged, material);
      mesh.userData = { ...list[0].userData };
      g.add(mesh);
    }
  }
  return root;
}
