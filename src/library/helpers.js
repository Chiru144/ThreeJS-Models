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
    if (!o.isMesh || o.userData.shell) return;
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

export function sculpt(nodes, opts) {
  // Signed-distance sculpting: smooth-blended primitives -> one continuous mesh via
  // surface nets, projected onto the true surface, with SDF normals, baked ambient
  // occlusion, vertex colours and skin weights. Node: { s: shape, op: 'u'|'s'|'i',
  // k: blend radius, bone, tint: [r,g,b], rot: [x,y,z], n: [amp, freq, kind] } or
  // { g: [nodes], op, k }. Shapes: ['e',cx,cy,cz,rx,ry,rz] ellipsoid, ['s',cx,cy,cz,r],
  // ['rc',ax,ay,az,bx,by,bz,ra,rb] round cone, ['b',cx,cy,cz,hx,hy,hz,r] round box,
  // ['cc',ax,ay,az,bx,by,bz,ra,rb] flat-capped cone/cylinder, ['t',cx,cy,cz,R,r] torus,
  // ['p',nx,ny,nz,d] half-space n.p <= d. Extras: round (inflate), sc (non-uniform scale).
  const cell = opts.cell, INF = 1e9;
  const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const noiseFn = (n) => {
    const [amp, f, kind] = n;
    if (kind === 'groove') return (x, y, z) => amp * Math.sin(Math.atan2(x, z) * f + y * f * 0.08);
    if (kind === 'vgroove') return (x, y, z) => amp * Math.sin(x * f + Math.sin(y * f * 0.12) * 1.5);
    if (kind === 'curl') return (x, y, z) => amp * Math.sin(x * f) * Math.sin(y * f) * Math.sin(z * f);
    if (kind === 'rows') return (x, y, z) => amp * Math.abs(Math.sin(y * f)) ** 0.35 * -1; // tile / plank / brick courses
    if (kind === 'tread') return (x, y, z) => amp * (Math.sin(Math.atan2(y, x) * f) > 0.3 ? 1 : 0); // tyre tread around z
    if (kind === 'fold') return (x, y, z) => amp * (Math.sin(y * f + Math.sin(x * f * 0.7) * 2) * 0.7 + Math.sin(z * f * 1.3 + x * f * 0.5) * 0.3);
    return (x, y, z) => amp * (Math.sin(x * f + Math.sin(z * f * 0.71)) * Math.sin(y * f * 1.13 + Math.sin(x * f * 0.53)) * Math.sin(z * f * 0.87 + 1.3));
  };
  const compile = (node, inh) => {
    // groups pass their bone / tint / weight falloff down to children that don't set their own
    if (inh) node = { ...node, bone: node.bone ?? inh.bone, tint: node.tint ?? inh.tint, wk: node.wk ?? inh.wk };
    if (node.g) {
      const kids = node.g.map((c) => compile(c, node));
      const box = [INF, INF, INF, -INF, -INF, -INF];
      for (const c of kids) if (c.op === 'u') for (let i = 0; i < 3; i++) { box[i] = Math.min(box[i], c.box[i]); box[i + 3] = Math.max(box[i + 3], c.box[i + 3]); }
      let f = (x, y, z) => { let d = INF; for (const c of kids) d = combine(d, c, x, y, z); return d; };
      if (node.n) { const g = f, nf = noiseFn(node.n); f = (x, y, z) => g(x, y, z) + nf(x, y, z); for (let i = 0; i < 3; i++) { box[i] -= Math.abs(node.n[0]); box[i + 3] += Math.abs(node.n[0]); } }
      return { f, box, op: node.op || 'u', k: node.k ?? 0, kids };
    }
    const s = node.s, t = s[0];
    let f, box;
    let R = null;
    if (node.rot) {
      const e = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...node.rot)).invert().elements;
      R = e;
    }
    // world-axis half extents of a local box (hx,hy,hz) under this node's rotation (R is the inverse rotation)
    const obb = (hx, hy, hz) => (R ? [Math.abs(R[0]) * hx + Math.abs(R[1]) * hy + Math.abs(R[2]) * hz, Math.abs(R[4]) * hx + Math.abs(R[5]) * hy + Math.abs(R[6]) * hz, Math.abs(R[8]) * hx + Math.abs(R[9]) * hy + Math.abs(R[10]) * hz] : [hx, hy, hz]);
    const local = (cx, cy, cz, g) => (R
      ? (x, y, z) => { const px = x - cx, py = y - cy, pz = z - cz; return g(R[0] * px + R[4] * py + R[8] * pz, R[1] * px + R[5] * py + R[9] * pz, R[2] * px + R[6] * py + R[10] * pz); }
      : (x, y, z) => g(x - cx, y - cy, z - cz));
    if (t === 'e') {
      const [, cx, cy, cz, rx, ry, rz] = s;
      f = local(cx, cy, cz, (x, y, z) => { const a = x / rx, b = y / ry, c = z / rz; const k0 = Math.sqrt(a * a + b * b + c * c); const k1 = Math.sqrt((a / rx) ** 2 + (b / ry) ** 2 + (c / rz) ** 2); return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1; });
      const ex = obb(rx, ry, rz); box = [cx - ex[0], cy - ex[1], cz - ex[2], cx + ex[0], cy + ex[1], cz + ex[2]];
    } else if (t === 's') {
      const [, cx, cy, cz, r] = s;
      f = (x, y, z) => Math.hypot(x - cx, y - cy, z - cz) - r;
      box = [cx - r, cy - r, cz - r, cx + r, cy + r, cz + r];
    } else if (t === 'rc') {
      const [, ax, ay, az, bx, by, bz, r1, r2] = s;
      const bax = bx - ax, bay = by - ay, baz = bz - az, l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
      f = (x, y, z) => {
        const pax = x - ax, pay = y - ay, paz = z - az, yy = pax * bax + pay * bay + paz * baz, zz = yy - l2;
        const xx = (pax * l2 - bax * yy) ** 2 + (pay * l2 - bay * yy) ** 2 + (paz * l2 - baz * yy) ** 2;
        const y2 = yy * yy * l2, z2 = zz * zz * l2, k = Math.sign(rr) * rr * rr * xx;
        if (Math.sign(zz) * a2 * z2 > k) return Math.sqrt(xx + z2) * il2 - r2;
        if (Math.sign(yy) * a2 * y2 < k) return Math.sqrt(xx + y2) * il2 - r1;
        return (Math.sqrt(xx * a2 * il2) + yy * rr) * il2 - r1;
      };
      const m = Math.max(r1, r2); box = [Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m, Math.max(az, bz) + m];
    } else if (t === 'b') {
      const [, cx, cy, cz, hx, hy, hz, r] = s;
      f = local(cx, cy, cz, (x, y, z) => { const qx = Math.abs(x) - hx + r, qy = Math.abs(y) - hy + r, qz = Math.abs(z) - hz + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r; });
      const ex = obb(hx, hy, hz); box = [cx - ex[0], cy - ex[1], cz - ex[2], cx + ex[0], cy + ex[1], cz + ex[2]];
    } else if (t === 'cc') { // capped cone / cylinder with flat ends (hard-surface): a, b, ra, rb
      const [, ax, ay, az, bx, by, bz, ra, rb] = s;
      const bax = bx - ax, bay = by - ay, baz = bz - az, baba = bax * bax + bay * bay + baz * baz, rba = rb - ra, kq = rba * rba + baba;
      f = (x, y, z) => {
        const pax = x - ax, pay = y - ay, paz = z - az, papa = pax * pax + pay * pay + paz * paz, paba = (pax * bax + pay * bay + paz * baz) / baba;
        const xx = Math.sqrt(Math.max(0, papa - paba * paba * baba));
        const cax = Math.max(0, xx - (paba < 0.5 ? ra : rb)), cay = Math.abs(paba - 0.5) - 0.5;
        const ff = Math.min(1, Math.max(0, (rba * (xx - ra) + paba * baba) / kq)), cbx = xx - ra - ff * rba, cby = paba - ff;
        return (cbx < 0 && cay < 0 ? -1 : 1) * Math.sqrt(Math.min(cax * cax + cay * cay * baba, cbx * cbx + cby * cby * baba));
      };
      const m = Math.max(ra, rb); box = [Math.min(ax, bx) - m, Math.min(ay, by) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(ay, by) + m, Math.max(az, bz) + m];
    } else if (t === 't') { // torus around the local y axis (use rot to orient): centre, R, r
      const [, cx, cy, cz, R0, r0] = s;
      f = local(cx, cy, cz, (x, y, z) => Math.hypot(Math.hypot(x, z) - R0, y) - r0);
      const m = R0 + r0; box = [cx - m, cy - m, cz - m, cx + m, cy + m, cz + m];
    } else if (t === 'p') {
      const [, nx, ny, nz, d] = s;
      f = (x, y, z) => nx * x + ny * y + nz * z - d;
      box = [-INF, -INF, -INF, INF, INF, INF];
    }
    if (node.round) { const g1 = f, rd = node.round; f = (x, y, z) => g1(x, y, z) - rd; box = box.map((q, i) => (i < 3 ? q - rd : q + rd)); }
    if (node.sc) {
      const [cx, cy, cz, sx, sy, sz] = node.sc, g0 = f, mn = Math.min(sx, sy, sz);
      f = (x, y, z) => g0(cx + (x - cx) / sx, cy + (y - cy) / sy, cz + (z - cz) / sz) * mn;
      box = [cx + (box[0] - cx) * sx, cy + (box[1] - cy) * sy, cz + (box[2] - cz) * sz, cx + (box[3] - cx) * sx, cy + (box[4] - cy) * sy, cz + (box[5] - cz) * sz];
    }
    if (node.n) { const g = f, nf = noiseFn(node.n); f = (x, y, z) => g(x, y, z) + nf(x, y, z); }
    const pad = (node.k ?? 0) + (node.n ? Math.abs(node.n[0]) : 0) + cell * 2;
    box = box.map((v, i) => (i < 3 ? v - pad : v + pad));
    return { f, box, op: node.op || 'u', k: node.k ?? 0, bone: node.bone ?? 0, tint: node.tint, wk: node.wk };
  };
  const combine = (d, c, x, y, z) => {
    if (c.op === 'u') return smin(d, c.f(x, y, z), c.k);
    if (c.op === 's') return smax(d, -c.f(x, y, z), c.k);
    return smax(d, c.f(x, y, z), c.k);
  };
  const top = nodes.map((n) => compile(n, null));
  // bounds from union nodes
  const B = [INF, INF, INF, -INF, -INF, -INF];
  for (const c of top) if (c.op === 'u') for (let i = 0; i < 3; i++) { B[i] = Math.min(B[i], c.box[i]); B[i + 3] = Math.max(B[i + 3], c.box[i + 3]); }
  const nx = Math.ceil((B[3] - B[0]) / cell) + 1, ny = Math.ceil((B[4] - B[1]) / cell) + 1, nz = Math.ceil((B[5] - B[2]) / cell) + 1;
  // coarse blocks hold the nodes that can affect them (culling)
  const BS = 5, bx = Math.ceil(nx / BS), by = Math.ceil(ny / BS), bz = Math.ceil(nz / BS);
  const blocks = new Array(bx * by * bz);
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    const x0 = B[0] + i * BS * cell, y0 = B[1] + j * BS * cell, z0 = B[2] + k * BS * cell, s = BS * cell;
    blocks[i + bx * (j + by * k)] = top.filter((c) => c.box[0] <= x0 + s && c.box[3] >= x0 && c.box[1] <= y0 + s && c.box[4] >= y0 && c.box[2] <= z0 + s && c.box[5] >= z0);
  }
  const sdf = (x, y, z) => {
    const i = Math.floor((x - B[0]) / (BS * cell)), j = Math.floor((y - B[1]) / (BS * cell)), k = Math.floor((z - B[2]) / (BS * cell));
    const list = i >= 0 && j >= 0 && k >= 0 && i < bx && j < by && k < bz ? blocks[i + bx * (j + by * k)] : top;
    let d = INF;
    for (const c of list) d = combine(d, c, x, y, z);
    return d;
  };
  const T0 = performance.now();
  // narrow band: sample block corners coarsely; only blocks near the surface get full sampling
  const V = new Float32Array(nx * ny * nz);
  const bd = BS * cell * Math.sqrt(3) * 1.25;
  const cx = bx + 1, cy = by + 1, cz = bz + 1, coarse = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) coarse[i + cx * (j + cy * k)] = sdf(B[0] + i * BS * cell, B[1] + j * BS * cell, B[2] + k * BS * cell);
  for (let k = 0; k < bz; k++) for (let j = 0; j < by; j++) for (let i = 0; i < bx; i++) {
    let mn = INF, mx = -INF;
    for (let c = 0; c < 8; c++) { const q = coarse[i + (c & 1) + cx * (j + ((c >> 1) & 1) + cy * (k + (c >> 2)))]; mn = Math.min(mn, q); mx = Math.max(mx, q); }
    const far = mn > bd ? bd : mx < -bd ? -bd : 0;
    const list = blocks[i + bx * (j + by * k)];
    for (let z = k * BS; z <= Math.min(nz - 1, k * BS + BS); z++) for (let y = j * BS; y <= Math.min(ny - 1, j * BS + BS); y++) for (let x = i * BS; x <= Math.min(nx - 1, i * BS + BS); x++) {
      const id = x + nx * (y + ny * z);
      if (far) { V[id] = far; continue; }
      const px = B[0] + x * cell, py = B[1] + y * cell, pz = B[2] + z * cell;
      let d = INF;
      for (const c of list) d = combine(d, c, px, py, pz);
      V[id] = d;
    }
  }
  const T1 = performance.now();
  // surface nets
  const cellIdx = new Int32Array((nx - 1) * (ny - 1) * (nz - 1)).fill(-1);
  const pos = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const [ox, oy, oz] = corner[c]; cv[c] = V[x + ox + nx * (y + oy + ny * (z + oz))]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += corner[a][0] + t * (corner[b][0] - corner[a][0]); sy += corner[a][1] + t * (corner[b][1] - corner[a][1]); sz += corner[a][2] + t * (corner[b][2] - corner[a][2]); n++;
    }
    cellIdx[x + (nx - 1) * (y + (ny - 1) * z)] = pos.length / 3;
    pos.push(B[0] + (x + sx / n) * cell, B[1] + (y + sy / n) * cell, B[2] + (z + sz / n) * cell);
  }
  const index = [];
  const C = (x, y, z) => cellIdx[x + (nx - 1) * (y + (ny - 1) * z)];
  for (let z = 0; z < nz - 1; z++) for (let y = 0; y < ny - 1; y++) for (let x = 0; x < nx - 1; x++) {
    const v0 = V[x + nx * (y + ny * z)];
    const inside = v0 < 0;
    // x-edge: cells (x,y,z) (x,y-1,z) (x,y-1,z-1) (x,y,z-1)
    if (y > 0 && z > 0 && inside !== (V[x + 1 + nx * (y + ny * z)] < 0)) {
      const q = [C(x, y, z), C(x, y - 1, z), C(x, y - 1, z - 1), C(x, y, z - 1)];
      if (inside) index.push(q[0], q[1], q[2], q[0], q[2], q[3]); else index.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
    if (x > 0 && z > 0 && inside !== (V[x + nx * (y + 1 + ny * z)] < 0)) {
      const q = [C(x, y, z), C(x, y, z - 1), C(x - 1, y, z - 1), C(x - 1, y, z)];
      if (inside) index.push(q[0], q[1], q[2], q[0], q[2], q[3]); else index.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
    if (x > 0 && y > 0 && inside !== (V[x + nx * (y + ny * (z + 1))] < 0)) {
      const q = [C(x, y, z), C(x - 1, y, z), C(x - 1, y - 1, z), C(x, y - 1, z)];
      if (inside) index.push(q[0], q[1], q[2], q[0], q[2], q[3]); else index.push(q[0], q[2], q[1], q[0], q[3], q[2]);
    }
  }
  // refine: project onto the surface, SDF normals, AO, weights, colour
  // every solid leaf knows its order, its top-level group and that group's blend radius (for skin weights)
  let leafOrder = 0;
  top.forEach((t, gi) => { const tag = (c) => { if (c.kids) c.kids.forEach(tag); else if (c.op === 'u') { c.ord = leafOrder++; c.gid = gi; c.gk = t.kids ? t.k : c.k; } }; tag(t); });
  const leafCache = new Map();
  const leavesOf = (list) => {
    if (!leafCache.has(list)) { const out = []; const collect = (c) => { if (c.kids) c.kids.forEach(collect); else if (c.op === 'u') out.push(c); }; list.forEach(collect); leafCache.set(list, out); }
    return leafCache.get(list);
  };
  const listAt = (x, y, z) => {
    const i = Math.floor((x - B[0]) / (BS * cell)), j = Math.floor((y - B[1]) / (BS * cell)), k = Math.floor((z - B[2]) / (BS * cell));
    return i >= 0 && j >= 0 && k >= 0 && i < bx && j < by && k < bz ? blocks[i + bx * (j + by * k)] : top;
  };
  const nv = pos.length / 3, e = cell * 0.3;
  const normal = new Float32Array(nv * 3), color = new Float32Array(nv * 3), skinIndex = new Uint16Array(nv * 4), skinWeight = new Float32Array(nv * 4);
  const grad = (x, y, z, out) => {
    const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), d = sdf(x + e, y + e, z + e);
    out[0] = a - b - c + d; out[1] = -a - b + c + d; out[2] = -a + b - c + d;
    const l = Math.hypot(out[0], out[1], out[2]) || 1; out[0] /= l; out[1] /= l; out[2] /= l;
  };
  const g = [0, 0, 0], aoScale = opts.aoScale ?? cell * 4, aoK = opts.ao ?? 1;
  const aoV = new Float32Array(nv), baseC = new Float32Array(nv * 3);
  const bw = new Map();
  const BP = opts.boneParents || null, wr = opts.weightRadius ?? cell * 4.5;
  // kin = within two steps in the skeleton tree (same bone, parent/child, siblings, grandparent)
  const up = (b) => (b >= 0 && BP[b] !== undefined ? BP[b] : -1);
  const kin = (a, b) => a === b || up(a) === b || up(b) === a || (up(a) >= 0 && up(a) === up(b)) || up(up(a)) === b || up(up(b)) === a;
  for (let v = 0; v < nv; v++) {
    let x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    { const d = sdf(x, y, z); grad(x, y, z, g); x -= g[0] * d; y -= g[1] * d; z -= g[2] * d; }
    pos[v * 3] = x; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z;
    normal.set(g, v * 3);
    let occ = 0, sca = 1;
    for (let i = 1; i <= 4; i++) { const h = aoScale * i * 1.2; occ += (h - sdf(x + g[0] * h, y + g[1] * h, z + g[2] * h)) * sca; sca *= 0.7; }
    const ao = Math.max(0.25, Math.min(1, 1 - aoK * occ / (aoScale * 3)));
    // skin weights + tint from nearby primitives
    const leaves = leavesOf(listAt(x, y, z));
    let dmin = INF, jmin = 0; const ds = leaves.map((c, i) => { const d = c.f(x, y, z); if (d < dmin) { dmin = d; jmin = i; } return d; });
    bw.clear();
    let tr = 0, tg = 0, tb = 0, tw = 0;
    const near = leaves[jmin];
    leaves.forEach((c, i) => {
      // Skin weights blend only across real joints (bones within two steps of each other in the skeleton) and only within the
      // blend radius around the surface the vertex sits on. Parts that are merely close - a cuff beside
      // the hip, one leg beside the other - get no influence, so nothing tears when the rig moves.
      let w = 1;
      if (c !== near) {
        if (BP && !kin(c.bone, near.bone)) w = 0; // not across a real joint
        else {
          const kp = c.wk ?? Math.max(wr, c.gid === near.gid ? (c.ord > near.ord ? c.k : near.k) : (c.gid > near.gid ? c.gk : near.gk));
          const u = 1 - (ds[i] - dmin) / (kp + cell * 0.75);
          w = u > 0 ? u * u : 0;
        }
      }
      if (w > 1e-3) bw.set(c.bone, (bw.get(c.bone) || 0) + w);
      const wt = Math.exp(-(ds[i] - dmin) / (cell * 0.8 + c.k * 0.15));
      const t = c.tint || [1, 1, 1];
      tr += t[0] * wt; tg += t[1] * wt; tb += t[2] * wt; tw += wt;
    });
    const top4 = [...bw].sort((a, b) => b[1] - a[1]).slice(0, 4);
    const sum = top4.reduce((s, q) => s + q[1], 0) || 1;
    top4.forEach(([bone, w], i) => { skinIndex[v * 4 + i] = bone; skinWeight[v * 4 + i] = w / sum; });
    if (!top4.length) skinWeight[v * 4] = 1;
    const c = [tr / tw, tg / tw, tb / tw];
    if (opts.paint) opts.paint(x, y, z, c, g);
    aoV[v] = ao; baseC[v * 3] = c[0]; baseC[v * 3 + 1] = c[1]; baseC[v * 3 + 2] = c[2];
  }
  // occlusion is smoothed over the mesh (two passes over neighbours): single vertices sampled deep in a crease
  // would otherwise show as dark specks along it
  {
    const acc = new Float32Array(nv), cnt = new Float32Array(nv);
    for (let it = 0; it < 2; it++) {
      acc.set(aoV); cnt.fill(1);
      for (let i = 0; i < index.length; i += 3) for (let e = 0; e < 3; e++) { const a = index[i + e], b = index[i + (e + 1) % 3]; acc[a] += aoV[b]; cnt[a]++; acc[b] += aoV[a]; cnt[b]++; }
      for (let v = 0; v < nv; v++) aoV[v] = acc[v] / cnt[v];
    }
    for (let v = 0; v < nv; v++) for (let k = 0; k < 3; k++) color[v * 3 + k] = Math.min(1, baseC[v * 3 + k] * aoV[v]); // clamped: valid glTF COLOR_0
  }
  // ---- repair: on features thinner than the grid the SDF gradient can point the wrong way; where it
  // disagrees with the mesh itself, fall back to the geometric normal
  {
    const gn = new Float32Array(nv * 3);
    for (let i = 0; i < index.length; i += 3) {
      const a = index[i] * 3, b = index[i + 1] * 3, c = index[i + 2] * 3;
      const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
      const fx = uy * vz - uz * vy, fy = uz * vx - ux * vz, fz = ux * vy - uy * vx;
      for (const q of [a, b, c]) { gn[q] += fx; gn[q + 1] += fy; gn[q + 2] += fz; }
    }
    for (let v = 0; v < nv; v++) {
      const l = Math.hypot(gn[v * 3], gn[v * 3 + 1], gn[v * 3 + 2]);
      if (l < 1e-20) continue;
      const d = (gn[v * 3] * normal[v * 3] + gn[v * 3 + 1] * normal[v * 3 + 1] + gn[v * 3 + 2] * normal[v * 3 + 2]) / l;
      if (d < 0.35) { normal[v * 3] = gn[v * 3] / l; normal[v * 3 + 1] = gn[v * 3 + 1] / l; normal[v * 3 + 2] = gn[v * 3 + 2] / l; }
    }
  }
  // ---- debris: drop tiny disconnected fragments left by cuts or sub-grid features
  {
    const parent = new Int32Array(nv); for (let i = 0; i < nv; i++) parent[i] = i;
    const find = (q) => { while (parent[q] !== q) { parent[q] = parent[parent[q]]; q = parent[q]; } return q; };
    for (let i = 0; i < index.length; i += 3) { const r0 = find(index[i]), r1 = find(index[i + 1]), r2 = find(index[i + 2]); if (r1 !== r0) parent[r1] = r0; if (r2 !== r0) parent[r2] = r0; }
    const size = new Map(); for (let v = 0; v < nv; v++) { const r = find(v); size.set(r, (size.get(r) || 0) + 1); }
    if (size.size > 1) {
      const limit = Math.max(16, nv * 0.0015);
      const kept = []; for (let i = 0; i < index.length; i += 3) if (size.get(find(index[i])) >= limit) kept.push(index[i], index[i + 1], index[i + 2]);
      if (kept.length && kept.length < index.length) { index.length = 0; for (const q of kept) index.push(q); }
    }
  }
  const T2 = performance.now();
  // ---- adaptive optimisation: collapse vertices whose surroundings are flat (within `simplify` degrees),
  // similarly coloured and skinned alike. Curved / detailed regions keep their full density.
  let outIndex = index, keep = null;
  const tol = opts.simplify ?? 0;
  if (tol > 0 && nv > 200) {
    const cosT = Math.cos((tol * Math.PI) / 180), cosN = Math.cos((tol * 2.2 * Math.PI) / 180), colTol = opts.colorTol ?? 0.05;
    const F = Int32Array.from(index), nf = F.length / 3, alive = new Uint8Array(nf).fill(1), dead = new Uint8Array(nv);
    const vf = Array.from({ length: nv }, () => []);
    for (let f = 0; f < nf; f++) { vf[F[f * 3]].push(f); vf[F[f * 3 + 1]].push(f); vf[F[f * 3 + 2]].push(f); }
    const fn = [0, 0, 0];
    const faceN = (i0, i1, i2) => {
      const ax = pos[i1 * 3] - pos[i0 * 3], ay = pos[i1 * 3 + 1] - pos[i0 * 3 + 1], az = pos[i1 * 3 + 2] - pos[i0 * 3 + 2];
      const bx2 = pos[i2 * 3] - pos[i0 * 3], by2 = pos[i2 * 3 + 1] - pos[i0 * 3 + 1], bz2 = pos[i2 * 3 + 2] - pos[i0 * 3 + 2];
      fn[0] = ay * bz2 - az * by2; fn[1] = az * bx2 - ax * bz2; fn[2] = ax * by2 - ay * bx2;
      const l = Math.hypot(fn[0], fn[1], fn[2]);
      if (l < 1e-14) return 0;
      fn[0] /= l; fn[1] /= l; fn[2] /= l;
      return l;
    };
    const locked = new Uint8Array(nv);
    for (let pass = 0; pass < 8; pass++) {
      locked.fill(0);
      let done = 0;
      for (let a = 0; a < nv; a++) {
        if (dead[a] || locked[a]) continue;
        const fa = vf[a];
        if (fa.length < 3 || fa.length > 12) continue;
        // the fan around `a` must be flat: every face normal close to a's surface normal
        const nax = normal[a * 3], nay = normal[a * 3 + 1], naz = normal[a * 3 + 2];
        let flat = true;
        for (const f of fa) { if (!faceN(F[f * 3], F[f * 3 + 1], F[f * 3 + 2]) || fn[0] * nax + fn[1] * nay + fn[2] * naz < cosT) { flat = false; break; } }
        if (!flat) continue;
        // candidate targets: neighbours with matching normal, colour and skinning; nearest first
        const nb = [];
        for (const f of fa) for (let k = 0; k < 3; k++) { const q = F[f * 3 + k]; if (q !== a && !nb.includes(q)) nb.push(q); }
        let target = -1, bestD = Infinity;
        for (const b2 of nb) {
          if (locked[b2]) continue;
          if (normal[b2 * 3] * nax + normal[b2 * 3 + 1] * nay + normal[b2 * 3 + 2] * naz < cosT) continue;
          if (Math.abs(color[a * 3] - color[b2 * 3]) + Math.abs(color[a * 3 + 1] - color[b2 * 3 + 1]) + Math.abs(color[a * 3 + 2] - color[b2 * 3 + 2]) > colTol) continue;
          if (skinIndex[a * 4] !== skinIndex[b2 * 4] || Math.abs(skinWeight[a * 4] - skinWeight[b2 * 4]) > 0.15) continue;
          const d = (pos[a * 3] - pos[b2 * 3]) ** 2 + (pos[a * 3 + 1] - pos[b2 * 3 + 1]) ** 2 + (pos[a * 3 + 2] - pos[b2 * 3 + 2]) ** 2;
          if (d < bestD) { bestD = d; target = b2; }
        }
        if (target < 0) continue;
        // link condition (keeps the mesh manifold): a and target share exactly two neighbours
        let shared = 0;
        const fb = vf[target];
        for (const q of nb) { if (q === target) continue; let has = false; for (const f of fb) { if (F[f * 3] === q || F[f * 3 + 1] === q || F[f * 3 + 2] === q) { has = true; break; } } if (has) shared++; }
        if (shared !== 2) continue;
        // no face may flip or drift off the surface
        let ok = true;
        for (const f of fa) {
          const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2];
          if (i0 === target || i1 === target || i2 === target) continue;
          const j0 = i0 === a ? target : i0, j1 = i1 === a ? target : i1, j2 = i2 === a ? target : i2;
          if (!faceN(j0, j1, j2)) { ok = false; break; }
          const mx = normal[j0 * 3] + normal[j1 * 3] + normal[j2 * 3], my = normal[j0 * 3 + 1] + normal[j1 * 3 + 1] + normal[j2 * 3 + 1], mz = normal[j0 * 3 + 2] + normal[j1 * 3 + 2] + normal[j2 * 3 + 2];
          if ((fn[0] * mx + fn[1] * my + fn[2] * mz) / (Math.hypot(mx, my, mz) || 1) < cosN) { ok = false; break; }
        }
        if (!ok) continue;
        for (const f of fa) {
          const i0 = F[f * 3], i1 = F[f * 3 + 1], i2 = F[f * 3 + 2];
          if (i0 === target || i1 === target || i2 === target) { alive[f] = 0; for (const q of [i0, i1, i2]) if (q !== a) { const l = vf[q], ix = l.indexOf(f); if (ix >= 0) l.splice(ix, 1); } }
          else { if (i0 === a) F[f * 3] = target; else if (i1 === a) F[f * 3 + 1] = target; else F[f * 3 + 2] = target; fb.push(f); }
        }
        vf[a] = []; dead[a] = 1; done++;
        locked[target] = 1; for (const q of nb) locked[q] = 1;
      }
      if (done < nv * 0.004) break;
    }
    keep = new Int32Array(nv).fill(-1);
    let m = 0;
    for (let v = 0; v < nv; v++) if (!dead[v]) keep[v] = m++;
    outIndex = [];
    for (let f = 0; f < nf; f++) if (alive[f]) outIndex.push(keep[F[f * 3]], keep[F[f * 3 + 1]], keep[F[f * 3 + 2]]);
    const pack = (src, size, C) => { const out = new C(m * size); for (let v = 0; v < nv; v++) if (keep[v] >= 0) for (let k = 0; k < size; k++) out[keep[v] * size + k] = src[v * size + k]; return out; };
    const P2 = pack(pos, 3, Float32Array), N2 = pack(normal, 3, Float32Array), C2 = pack(color, 3, Float32Array), I2 = pack(skinIndex, 4, Uint16Array), W2 = pack(skinWeight, 4, Float32Array);
    if (globalThis.SCULPT_PROFILE) console.log('  simplify', nv, '->', m, 'verts', (performance.now() - T2).toFixed(0), 'ms');
    const g2 = new THREE.BufferGeometry();
    g2.setAttribute('position', new THREE.BufferAttribute(P2, 3)); g2.setAttribute('normal', new THREE.BufferAttribute(N2, 3)); g2.setAttribute('color', new THREE.BufferAttribute(C2, 3));
    g2.setAttribute('skinIndex', new THREE.BufferAttribute(I2, 4)); g2.setAttribute('skinWeight', new THREE.BufferAttribute(W2, 4));
    g2.setIndex(outIndex);
    return g2;
  }
  if (globalThis.SCULPT_PROFILE) console.log('sculpt', nx, ny, nz, 'grid', (T1 - T0).toFixed(0), 'refine', (performance.now() - T1).toFixed(0), 'verts', nv);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(color, 3));
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
  geo.setAttribute('skinWeight', new THREE.BufferAttribute(skinWeight, 4));
  geo.setIndex(index);
  return geo;
}

export function rigKit(M, spec, lod) {
  // Shared toolkit for sculpted, skinned creatures. spec: [[bone, parent|null, [x,y,z] world rest position], ...]
  const B = {}, at = {}, bones = [];
  spec.forEach(([n, par, pos], i) => {
    const b = new THREE.Bone(); b.name = n; B[n] = i; at[n] = pos; bones.push(b);
    const pw = par ? at[par] : [0, 0, 0];
    b.position.set(pos[0] - pw[0], pos[1] - pw[1], pos[2] - pw[2]);
    if (par) bones[B[par]].add(b);
  });
  const root = new THREE.Group();
  root.add(bones[0]);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);
  const bo = (o = {}) => (typeof o.bone === 'string' ? { ...o, bone: B[o.bone] } : o);
  const E = (c, r, o) => ({ s: ['e', ...c, ...r], ...bo(o) });
  const S = (c, r, o) => ({ s: ['s', ...c, r], ...bo(o) });
  const RC = (a, b, ra, rb, o) => ({ s: ['rc', ...a, ...b, ra, rb], ...bo(o) });
  const RB = (c, h, r, o) => ({ s: ['b', ...c, ...h, r], ...bo(o) });
  const PL = (n, pt, o) => { const l = Math.hypot(...n); const nn = n.map((q) => q / l); return { s: ['p', ...nn, nn[0] * pt[0] + nn[1] * pt[1] + nn[2] * pt[2]], op: 'i', ...bo(o) }; };
  const G = (g, o) => ({ g, ...bo(o) });
  const cache = (sculpt.cache ||= new Map());
  const boneParents = spec.map(([, par]) => (par ? B[par] : -1));
  const make = (nodes, cell, material, opts = {}) => {
    const list = nodes.filter(Boolean);
    if (!list.length) return null;
    const key = JSON.stringify([list, cell, opts.ao, lod, opts.paintKey, boneParents]);
    let geo = cache.get(key);
    if (!geo) { geo = sculpt(list, { cell: cell * lod, ao: opts.ao ?? 1, paint: opts.paint, simplify: opts.simplify ?? 3.5, colorTol: opts.colorTol ?? 0.06, boneParents }); cache.set(key, geo); }
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    return mesh;
  };
  const texCache = (rigKit.tex ||= new Map());
  const eye = (pos, r, bone, color, pupil = 'round', dir = [0, 0, 1], material) => {
    // glossy eyeball with a procedural iris; pupil: round | slit | bar
    const key = `${color}|${pupil}`;
    if (!texCache.has(key)) {
      const W = 64, Hh = 64, data = new Uint8Array(W * Hh * 4), ic = new THREE.Color(color);
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const th = (1 - y / (Hh - 1)) * Math.PI, u = (x / W) * Math.PI * 2;
        let c = [0.85, 0.82, 0.78];
        const irisR = pupil === 'round' ? 0.75 : 1.05;
        if (th < irisR) {
          const fib = 0.7 + 0.3 * Math.sin(u * 19 + Math.sin(u * 7) * 2) * Math.sin(th * 30);
          const k = fib * (0.55 + 0.6 * th / irisR);
          c = [ic.r * k, ic.g * k, ic.b * k];
          const px = Math.sin(th) * Math.cos(u), py = Math.sin(th) * Math.sin(u);
          const inPupil = pupil === 'slit' ? Math.abs(px) < 0.12 * Math.cos(Math.min(1.5, Math.abs(py) * 1.6)) && Math.abs(py) < 0.75
            : pupil === 'bar' ? Math.abs(py) < 0.16 && Math.abs(px) < 0.55 : th < 0.3;
          if (inPupil) c = [0.01, 0.01, 0.01];
          if (th > irisR * 0.92) c = c.map((q) => q * 0.45);
        }
        const i = (x + y * W) * 4;
        for (let k = 0; k < 3; k++) data[i + k] = Math.round(Math.min(1, Math.max(0, c[k])) ** (1 / 2.2) * 255);
        data[i + 3] = 255;
      }
      const t = new THREE.DataTexture(data, W, Hh); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
      texCache.set(key, t);
    }
    const mat = material || M(`eye_${color.toString(16)}_${pupil}`, { map: texCache.get(key), roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.04 }, 'MeshPhysicalMaterial');
    const g = new THREE.SphereGeometry(r, 20, 14); g.rotateX(Math.PI / 2);
    const e = new THREE.Mesh(g, mat);
    const b = bones[typeof bone === 'string' ? B[bone] : bone];
    const bw = new THREE.Vector3(); b.getWorldPosition(bw);
    e.position.set(pos[0] - bw.x, pos[1] - bw.y, pos[2] - bw.z);
    const l = Math.hypot(...dir);
    e.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(dir[0] / l, dir[1] / l, dir[2] / l));
    b.add(e);
    return e;
  };
  // helpers for coats: deterministic value noise + worley distance
  const hash = (x, y, z) => { const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); };
  const vnoise = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), fx = x - ix, fy = y - iy, fz = z - iz;
    const u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy), q = fz * fz * (3 - 2 * fz);
    let r = 0;
    for (let c = 0; c < 8; c++) { const dx = c & 1, dy = (c >> 1) & 1, dz = c >> 2; r += hash(ix + dx, iy + dy, iz + dz) * (dx ? u : 1 - u) * (dy ? w : 1 - w) * (dz ? q : 1 - q); }
    return r;
  };
  const worley = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
    let d1 = 9, d2 = 9;
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (let c = -1; c <= 1; c++) {
      const cx = ix + a + hash(ix + a, iy + b, iz + c), cy = iy + b + hash(iy + b, iz + c, ix + a), cz = iz + c + hash(iz + c, ix + a, iy + b);
      const d = Math.hypot(x - cx, y - cy, z - cz);
      if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
    }
    return [d1, d2];
  };
  return { root, bones, B, at, skeleton, boneParents, E, S, RC, RB, PL, G, make, eye, vnoise, worley };
}

export function surfaceTex(kind, size = 256) {
  // Tileable procedural ground textures (albedo variation + normal map), cached per kind.
  const cache = (surfaceTex.cache ||= new Map());
  if (cache.has(kind)) return cache.get(kind);
  const N = size, h = new Float32Array(N * N), alb = new Float32Array(N * N * 3);
  const P = 16, perm = [];
  for (let i = 0; i < P * P; i++) { const q = Math.sin(i * 127.1 + kind.length * 31.7) * 43758.5453; perm.push(q - Math.floor(q)); }
  const vn = (x, y, f) => { // tileable value noise with period f
    const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), w = fy * fy * (3 - 2 * fy);
    const g = (a, b) => perm[((((a % f) + f) % f) % P) + P * ((((b % f) + f) % f) % P)];
    return g(xi, yi) * (1 - u) * (1 - w) + g(xi + 1, yi) * u * (1 - w) + g(xi, yi + 1) * (1 - u) * w + g(xi + 1, yi + 1) * u * w;
  };
  const fbm = (x, y, o = 5) => { let a = 0, amp = 0.5, f = 4; for (let i = 0; i < o; i++) { a += amp * vn(x * f, y * f, Math.min(P, f)); amp *= 0.5; f *= 2; } return a; };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const u = x / N, v = y / N, i = x + y * N;
    let height = fbm(u, v), r = 1, g = 1, b = 1;
    if (kind === 'grass') { const blades = fbm(u * 4, v * 4, 3); height = height * 0.5 + blades * 0.5; const k = 0.75 + height * 0.5; r = k * (0.9 + 0.2 * vn(u * 8, v * 8, 8)); g = k; b = k * 0.85; }
    else if (kind === 'sand') { height = height * 0.4 + 0.6 * (0.5 + 0.5 * Math.sin((v + fbm(u, v, 2) * 0.3) * Math.PI * 2 * 12)); const k = 0.88 + fbm(u * 2, v * 2, 3) * 0.25; r = g = b = k; }
    else if (kind === 'snow') { const k = 0.93 + height * 0.1; r = g = k; b = k * 1.02; height *= 0.5; }
    else if (kind === 'stone') { // cobbles: cells with darker mortar
      const cx = u * 8, cy = v * 8; let d1 = 9, d2 = 9;
      for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) { const ix = Math.floor(cx) + a, iy = Math.floor(cy) + c; const px = ix + perm[((ix % 8 + 8) % 8) + P * ((iy % 8 + 8) % 8)], py = iy + perm[((iy % 8 + 8) % 8) + P * ((ix % 8 + 8) % 8)]; const d = Math.hypot(cx - px, cy - py); if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d; }
      const edge = Math.min(1, (d2 - d1) * 6); height = edge * 0.8 + height * 0.2; const k = 0.55 + edge * 0.45 * (0.85 + 0.3 * perm[(Math.floor(cx) % 8 + 8) % 8]); r = g = b = k;
    } else if (kind === 'wood') { const plank = Math.floor(v * 8), sh = perm[plank % P]; const grain = 0.5 + 0.5 * Math.sin((u + sh) * 60 + fbm(u, v, 3) * 8); const seam = (v * 8) % 1 < 0.04 ? 0.5 : 1; const k = (0.75 + 0.25 * grain) * (0.85 + 0.3 * sh) * seam; r = g = b = k; height = grain * 0.3 + (seam < 1 ? 0 : 0.7); }
    else { const k = 0.85 + height * 0.3; r = g = b = k; }
    h[i] = height; alb[i * 3] = r; alb[i * 3 + 1] = g; alb[i * 3 + 2] = b;
  }
  const map = new Uint8Array(N * N * 4), nrm = new Uint8Array(N * N * 4);
  const strength = kind === 'stone' ? 6 : kind === 'wood' ? 3 : 4;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = x + y * N;
    const dx = (h[((x + 1) % N) + y * N] - h[((x - 1 + N) % N) + y * N]) * strength, dy = (h[x + ((y + 1) % N) * N] - h[x + ((y - 1 + N) % N) * N]) * strength;
    const l = Math.hypot(dx, dy, 1);
    nrm[i * 4] = Math.round((-dx / l * 0.5 + 0.5) * 255); nrm[i * 4 + 1] = Math.round((-dy / l * 0.5 + 0.5) * 255); nrm[i * 4 + 2] = Math.round((1 / l * 0.5 + 0.5) * 255); nrm[i * 4 + 3] = 255;
    for (let c = 0; c < 3; c++) map[i * 4 + c] = Math.round(Math.min(1, alb[i * 3 + c]) ** (1 / 2.2) * 255);
    map[i * 4 + 3] = 255;
  }
  const mk = (data, srgb) => { const t = new THREE.DataTexture(data, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
  const out = { map: mk(map, true), normalMap: mk(nrm, false) };
  cache.set(kind, out);
  return out;
}

export function grassField(count, radius, color, seed, occupied, ticks) {
  // Instanced grass blades (one draw call) with wind sway in the vertex shader.
  const blade = new THREE.BufferGeometry();
  const segs = 4, pos = [], col = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs, w = 0.012 * (1 - t * 0.85), bend = t * t * 0.08;
    pos.push(-w, t * 0.3, bend, w, t * 0.3, bend);
    const k = 0.35 + t * 0.75; col.push(k, k, k, k, k, k);
    if (i < segs) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  blade.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  blade.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  blade.setIndex(idx);
  blade.computeVertexNormals();
  const time = { value: 0 };
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.75, side: THREE.DoubleSide, vertexColors: true });
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uTime = time;
    sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vec4 gw = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n  float sway = position.y * position.y * 6.0;\n  transformed.x += sin(uTime * 1.6 + gw.x * 0.31 + gw.z * 0.17) * 0.05 * sway;\n  transformed.z += cos(uTime * 1.2 + gw.x * 0.23) * 0.035 * sway;');
  };
  mat.customProgramCacheKey = () => 'grass-wind';
  const im = new THREE.InstancedMesh(blade, mat, count);
  const r = rng(seed), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  let n = 0;
  for (let tries = 0; n < count && tries < count * 3; tries++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * radius, x = Math.cos(a) * d, z = Math.sin(a) * d;
    if (occupied.some((o) => Math.hypot(x - o[0], z - o[1]) < o[2] * 0.6)) continue;
    const s = 0.55 + r() * 0.9;
    m4.compose(v.set(x, heightAt(x, z), z), q.setFromEuler(e.set((r() - 0.5) * 0.4, r() * Math.PI * 2, (r() - 0.5) * 0.4)), sc.set(s, s * (0.7 + r() * 0.8), s));
    im.setMatrixAt(n, m4);
    im.setColorAt(n, c.setHSL(0.24 + r() * 0.07, 0.45 + r() * 0.2, 0.5 + r() * 0.35));
    n++;
  }
  im.count = n;
  im.instanceMatrix.needsUpdate = true;
  im.computeBoundingSphere();
  im.userData.noCast = true;
  ticks.push((t) => { time.value = t; });
  return im;
}

export function detailize(material, kind, freq, amp = 1, print = null) {
  // print (optional): a woven colour pattern { kind: 'plaid'|'stripes'|'checks'|'dots', scale: metres per repeat }
  // Procedural micro-detail (no textures, no UVs): perturbs the shading normal and roughness from a 3D
  // pattern in bind-pose object space, so it sticks to skinned meshes. Fades out with distance (no shimmer).
  if (!material || material.userData.detail) return material;
  const printFn = print && {
    plaid: 'float a = smoothstep(0.42, 0.46, abs(fract(q.x) - 0.5)), b = smoothstep(0.42, 0.46, abs(fract(q.y) - 0.5)); float wa = step(0.5, fract(q.x)), wb = step(0.5, fract(q.y)); float l = max(step(0.955, fract(q.x * 2.0 + 0.1)), step(0.955, fract(q.y * 2.0 + 0.1))); diffuseColor.rgb *= 1.0 - 0.32 * wa - 0.32 * wb + 0.1 * wa * wb; diffuseColor.rgb *= 1.0 - 0.45 * max(a, b); diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.88, 0.82), l * 0.4);', // tartan: dark warp and weft bands, crossing darker, thin light overcheck
    stripes: 'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.92, 0.9), step(0.55, fract(q.y)));',
    checks: 'float c = mod(floor(q.x) + floor(q.y) + floor(q.z), 2.0); diffuseColor.rgb *= 0.55 + 0.45 * c;',
    dots: 'vec3 f = fract(q + vec3(0.0, floor(q.x) * 0.5, 0.0)) - 0.5; diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.95, 0.94, 0.92), 1.0 - smoothstep(0.17, 0.21, length(f.xy)));',
  }[print.kind];
  material.userData.detail = kind;
  const pattern = {
    pores: 'fn3(p) * 0.55 + fn3(p * 2.7) * 0.45',
    weave: 'abs(sin(p.x * 3.1416)) * abs(sin(p.y * 3.1416 + p.z * 3.1416)) * 0.8 + fn3(p * 3.0) * 0.2',
    knit: 'abs(sin(p.y * 3.1416 + sin(p.x * 6.2832) * 0.6)) * 0.85 + fn3(p * 2.0) * 0.15',
    scales: '1.0 - min(1.0, length(fract(p + vec3(0.0, floor(p.x) * 0.5, floor(p.x) * 0.5)) - 0.5) * 1.7)',
    grain: 'fn3(p) * 0.5 + fn3(p * 2.1) * 0.3 + fn3(p * 4.7) * 0.2',
    bark: 'fn3(p * vec3(1.0, 0.12, 1.0)) * 0.7 + fn3(p * vec3(2.3, 0.4, 2.3)) * 0.3',
    brushed: 'fn3(p * vec3(1.0, 28.0, 1.0))',
    leather: '1.0 - smoothstep(0.0, 0.25, abs(fn3(p) - 0.5)) * 0.7 - fn3(p * 3.0) * 0.3',
  }[kind] || 'fn3(p)';
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;');
    if (printFn) sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 q = vObjPos / ${print.scale.toFixed(4)}; ${printFn} }`);
    sh.fragmentShader = `varying vec3 vObjPos;
float fh3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fn3(vec3 p) { vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(fh3(i), fh3(i + vec3(1, 0, 0)), f.x), mix(fh3(i + vec3(0, 1, 0)), fh3(i + vec3(1, 1, 0)), f.x), f.y),
             mix(mix(fh3(i + vec3(0, 0, 1)), fh3(i + vec3(1, 0, 1)), f.x), mix(fh3(i + vec3(0, 1, 1)), fh3(i + vec3(1, 1, 1)), f.x), f.y), f.z); }
float fdetail(vec3 p) { return ${pattern}; }
` + sh.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  {
    vec3 dp = vObjPos * ${freq.toFixed(2)};
    float fade = clamp(1.0 - length(fwidth(dp)) * 0.75, 0.0, 1.0); // sub-pixel detail fades instead of aliasing
    float hgt = fdetail(dp);
    vec2 dH = vec2(dFdx(hgt), dFdy(hgt)) * ${(amp * 0.3 / freq).toExponential(3)} * fade; // height in metres: a fraction of one pattern cell
    vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition);
    vec3 r1 = cross(sy, normal), r2 = cross(normal, sx);
    float det = dot(sx, r1) * faceDirection;
    normal = normalize(abs(det) * normal - sign(det) * (dH.x * r1 + dH.y * r2));
    roughnessFactor = clamp(roughnessFactor * (1.0 + ${(Math.min(amp, 1) * 0.28).toFixed(3)} * (hgt - 0.5) * fade), 0.03, 1.0);
  }`);
  };
  material.customProgramCacheKey = () => `detail-${kind}-${freq.toFixed(2)}-${amp}-${print ? print.kind + print.scale : ''}`;
  return material;
}

export function furShells(root, mesh, fur) {
  // Shell fur: the coat is drawn again in thin offset layers; each layer keeps only "strand" cells, which
  // taper towards the tip. Strands are cells of a 3D lattice in bind-pose space, so fur follows the skin.
  const { len, density, shells = 8, tip = 1.25, rootShade = 0.55 } = fur;
  const out = [];
  for (let i = 1; i <= shells; i++) {
    const h = i / shells, m = mesh.material.clone();
    m.userData = { shell: h };
    const uni = { uShell: { value: h } };
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uShell = uni.uShell;
      sh.vertexShader = 'uniform float uShell;\nvarying vec3 vFurPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>\n  vFurPos = position;\n  transformed += normal * (uShell * ${len.toFixed(5)});`);
      sh.fragmentShader = `uniform float uShell;\nvarying vec3 vFurPos;\nfloat furHash(vec3 p) { return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n` + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
  {
    vec3 fp = vFurPos * ${density.toFixed(2)};
    vec3 cellId = floor(fp);
    float strand = 0.35 + 0.65 * furHash(cellId);           // strand length varies
    float dist = length(fract(fp) - 0.5);                    // distance from the strand's centre
    if (uShell > strand || dist > 0.62 * (1.0 - uShell / strand) + 0.05) discard;
    diffuseColor.rgb *= mix(${rootShade.toFixed(2)}, ${tip.toFixed(2)}, uShell) * (0.9 + 0.2 * furHash(cellId + 7.0));
  }`);
    };
    m.customProgramCacheKey = () => `fur-${len.toFixed(5)}-${density.toFixed(2)}-${tip}-${rootShade}`;
    const s = mesh.isSkinnedMesh ? new THREE.SkinnedMesh(mesh.geometry, m) : new THREE.Mesh(mesh.geometry, m);
    s.frustumCulled = false;
    s.userData = { shell: true, noCast: true };
    s.name = `${mesh.name || 'coat'}_fur${i}`;
    root.add(s);
    if (mesh.isSkinnedMesh) s.bind(mesh.skeleton, new THREE.Matrix4());
    out.push(s);
  }
  return out;
}
