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

export function sculpt(nodes, opts) {
  // Signed-distance sculpting: smooth-blended primitives -> one continuous mesh via
  // surface nets, projected onto the true surface, with SDF normals, baked ambient
  // occlusion, vertex colours and skin weights. Node: { s: shape, op: 'u'|'s'|'i',
  // k: blend radius, bone, tint: [r,g,b], rot: [x,y,z], n: [amp, freq, kind] } or
  // { g: [nodes], op, k }. Shapes: ['e',cx,cy,cz,rx,ry,rz] ellipsoid, ['s',cx,cy,cz,r],
  // ['rc',ax,ay,az,bx,by,bz,ra,rb] round cone, ['b',cx,cy,cz,hx,hy,hz,r] round box,
  // ['p',nx,ny,nz,d] half-space n.p <= d.
  const cell = opts.cell, INF = 1e9;
  const smin = (a, b, k) => { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const noiseFn = (n) => {
    const [amp, f, kind] = n;
    if (kind === 'groove') return (x, y, z) => amp * Math.sin(Math.atan2(x, z) * f + y * f * 0.08);
    if (kind === 'vgroove') return (x, y, z) => amp * Math.sin(x * f + Math.sin(y * f * 0.12) * 1.5);
    if (kind === 'curl') return (x, y, z) => amp * Math.sin(x * f) * Math.sin(y * f) * Math.sin(z * f);
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
    const local = (cx, cy, cz, g) => (R
      ? (x, y, z) => { const px = x - cx, py = y - cy, pz = z - cz; return g(R[0] * px + R[4] * py + R[8] * pz, R[1] * px + R[5] * py + R[9] * pz, R[2] * px + R[6] * py + R[10] * pz); }
      : (x, y, z) => g(x - cx, y - cy, z - cz));
    if (t === 'e') {
      const [, cx, cy, cz, rx, ry, rz] = s;
      f = local(cx, cy, cz, (x, y, z) => { const a = x / rx, b = y / ry, c = z / rz; const k0 = Math.sqrt(a * a + b * b + c * c); const k1 = Math.sqrt((a / rx) ** 2 + (b / ry) ** 2 + (c / rz) ** 2); return k1 < 1e-9 ? -Math.min(rx, ry, rz) : (k0 * (k0 - 1)) / k1; });
      const m = Math.max(rx, ry, rz); box = [cx - m, cy - m, cz - m, cx + m, cy + m, cz + m];
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
      const m = Math.hypot(hx, hy, hz); box = [cx - m, cy - m, cz - m, cx + m, cy + m, cz + m];
    } else if (t === 'p') {
      const [, nx, ny, nz, d] = s;
      f = (x, y, z) => nx * x + ny * y + nz * z - d;
      box = [-INF, -INF, -INF, INF, INF, INF];
    }
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
  const bw = new Map();
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
    let dmin = INF; const ds = leaves.map((c) => { const d = c.f(x, y, z); if (d < dmin) dmin = d; return d; });
    bw.clear();
    let tr = 0, tg = 0, tb = 0, tw = 0;
    leaves.forEach((c, i) => {
      const fall = c.wk ?? (c.k * 0.6 + cell);
      const w = Math.exp(-(ds[i] - dmin) / fall);
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
    color[v * 3] = c[0] * ao; color[v * 3 + 1] = c[1] * ao; color[v * 3 + 2] = c[2] * ao;
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
  const make = (nodes, cell, material, opts = {}) => {
    const list = nodes.filter(Boolean);
    if (!list.length) return null;
    const key = JSON.stringify([list, cell, opts.ao, lod, opts.paintKey]);
    let geo = cache.get(key);
    if (!geo) { geo = sculpt(list, { cell: cell * lod, ao: opts.ao ?? 1, paint: opts.paint }); cache.set(key, geo); }
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
  return { root, bones, B, at, skeleton, E, S, RC, RB, PL, G, make, eye, vnoise, worley };
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
