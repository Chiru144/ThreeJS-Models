// Realistic creatures: sculpted (signed-distance) anatomy, skinned to skeletons,
// with procedurally painted coats. Same params as the stylized creatures.js
// factories, so the Creature agent's plans drive both styles.
/* eslint-disable no-undef */

// ---------------- quadrupeds ----------------
function makeQuadruped(THREE, M, p, main) {
  const v = p.vary ? rng(6007 + (p.variant ?? 0) * 7919) : null;
  const L = p.bodyLen ?? 0.75, BH = p.bodyH ?? 0.3, BW = p.bodyW ?? 0.25, LEG = p.legLen ?? 0.36;
  const LR = p.legR ?? BW * 0.13, NL = p.neckLen ?? 0.2, NR = p.neckR ?? BH * 0.3, elev = p.neckAngle ?? 0.8;
  const HL = p.headLen ?? 0.26, HH = p.headH ?? 0.17, SN = p.snout ?? 0.1, pitch = p.headPitch ?? 0.15;
  const lod = p.lod === 'low' ? 2 : 1;
  const hoofed = !!p.hooves;
  const bodyY = LEG + BH * 0.42;
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const nd = [0, Math.sin(elev), Math.cos(elev)];
  const Nb = [0, bodyY + BH * 0.2, L * 0.4];
  const Nm = add(Nb, nd, NL * 0.5), Hd = add(Nb, nd, NL);
  const hf = [0, -Math.sin(pitch), Math.cos(pitch)], hu = [0, Math.cos(pitch), Math.sin(pitch)];
  const hq = (f, u, x = 0) => [Hd[0] + hf[0] * f + hu[0] * u + x, Hd[1] + hf[1] * f + hu[1] * u, Hd[2] + hf[2] * f + hu[2] * u];
  const legs = [];
  for (const [sx, front] of [[1, true], [-1, true], [1, false], [-1, false]]) {
    const zf = front ? 1 : -1;
    const top = front ? [sx * BW * 0.34, bodyY - BH * 0.06, L * 0.32] : [sx * BW * 0.33, bodyY + BH * 0.06, -L * 0.31];
    const mid = front ? [sx * BW * 0.33, bodyY - BH * 0.52, L * 0.29] : [sx * BW * 0.36, bodyY - BH * 0.46, -L * 0.21];
    const low = front ? [sx * BW * 0.31, LEG * 0.4, L * 0.32] : [sx * BW * 0.29, LEG * 0.42, -L * 0.41];
    const fet = front ? [sx * BW * 0.31, LEG * 0.1, L * 0.34] : [sx * BW * 0.29, LEG * 0.1, -L * 0.37];
    const toe = [fet[0], 0, fet[2] + zf * 0 + LR * 0.5];
    legs.push({ sx, front, top, mid, low, fet, toe });
  }
  const tailBase = [0, bodyY + BH * 0.22, -L * 0.48];
  const tdir = [0, Math.sin(p.tailUp ?? 0.3), -Math.cos(p.tailUp ?? 0.3)];
  const TL = p.tailLen ?? 0.3;
  const spec = [
    ['body', null, [0, bodyY, 0]], ['hips', 'body', [0, bodyY + BH * 0.05, -L * 0.28]], ['chest', 'body', [0, bodyY + BH * 0.05, L * 0.26]],
    ['neck', 'chest', Nb], ['neck2', 'neck', Nm], ['head', 'neck2', Hd],
  ];
  legs.forEach((l, i) => { const par = l.front ? 'chest' : 'hips'; spec.push([`u${i}`, par, l.top], [`m${i}`, `u${i}`, l.mid], [`f${i}`, `m${i}`, l.low]); });
  spec.push(['t0', 'hips', tailBase], ['t1', 't0', add(tailBase, tdir, TL * 0.35)], ['t2', 't1', add(tailBase, tdir, TL * 0.7)]);
  const wingSpan = p.wingSpan ?? L * 1.1;
  if (p.wings) for (const sx of [1, -1]) { const w0 = [sx * BW * 0.3, bodyY + BH * 0.38, L * 0.18]; spec.push([`w${sx > 0 ? 'L' : 'R'}0`, 'chest', w0], [`w${sx > 0 ? 'L' : 'R'}1`, `w${sx > 0 ? 'L' : 'R'}0`, add(w0, [sx * wingSpan * 0.45, 0, 0])]); }
  const trunkTop = hq(HL * 0.45, -HH * 0.1);
  if (p.trunk) spec.push(['k0', 'head', trunkTop], ['k1', 'k0', add(trunkTop, [0, -HH * 0.55, HH * 0.12])], ['k2', 'k1', add(trunkTop, [0, -HH * 1.1, HH * 0.18])]);
  const K = rigKit(M, spec, lod);
  const { E, S, RC, PL, G, make, root, bones, B } = K;

  // --- coat (fur / scales / wool) ---
  const coat = [];
  const kk = BH * 0.28;
  coat.push(
    E([0, bodyY, L * 0.04], [BW * 0.5, BH * 0.5, L * 0.36], { bone: 'body' }),
    E([0, bodyY - BH * 0.05, L * 0.28], [BW * 0.47, BH * 0.48, L * 0.2], { bone: 'chest', k: kk }),
    E([0, bodyY + BH * 0.2, L * 0.27], [BW * 0.3, BH * 0.32, L * 0.17], { bone: 'chest', k: kk }),
    E([0, bodyY + BH * 0.08, -L * 0.29], [BW * 0.48, BH * 0.46, L * 0.22], { bone: 'hips', k: kk }),
    E([0, bodyY - BH * 0.14, -L * 0.02], [BW * 0.44, BH * 0.38, L * 0.3], { bone: 'body', k: kk }),
  );
  legs.forEach((l, i) => {
    const u = `u${i}`, m = `m${i}`, f = `f${i}`;
    if (l.front) {
      coat.push(E(add(l.top, [l.sx * BW * 0.04, BH * 0.12, 0]), [BW * 0.13, BH * 0.42, L * 0.11], { bone: u, k: kk * 0.8, rot: [-0.3, 0, 0] }));
      coat.push(RC(l.top, l.mid, LR * 2.1, LR * 1.55, { bone: u, k: kk * 0.6 }));
      coat.push(RC(l.mid, l.low, LR * 1.6, LR * 0.95, { bone: m, k: LR * 0.8 }));
    } else {
      coat.push(E(lerp(l.top, l.mid, 0.4), [BW * 0.21, BH * 0.5, L * 0.15], { bone: u, k: kk * 0.7 }));
      coat.push(RC(l.top, l.mid, LR * 2.4, LR * 1.7, { bone: u, k: kk * 0.6 }));
      coat.push(RC(l.mid, l.low, LR * 1.75, LR * 0.95, { bone: m, k: LR * 0.8 }));
      coat.push(S(add(l.low, [0, LR * 0.2, -LR * 0.5]), LR * 0.9, { bone: f, k: LR * 0.6 }));
    }
    coat.push(S(l.low, LR * 1.05, { bone: f, k: LR * 0.5 }));
    coat.push(RC(l.low, l.fet, LR * 0.82, LR * 0.75, { bone: f, k: LR * 0.4 }));
    coat.push(S(l.fet, LR * 0.95, { bone: f, k: LR * 0.5 }));
    if (!hoofed) coat.push(E([l.fet[0], LR * 0.75, l.fet[2] + LR * 0.6], [LR * 1.15, LR * 0.75, LR * 1.45], { bone: f, k: LR * 0.6 }));
    else coat.push(RC(l.fet, [l.fet[0], LEG * 0.05, l.fet[2] + LR * 0.35], LR * 0.78, LR * 0.82, { bone: f, k: LR * 0.3 }));
  });
  // neck
  const nTop = Math.min(NR * 0.85, HH * 0.6);
  coat.push(RC(Nb, Nm, NR * 1.45, (NR * 1.45 + nTop) / 2, { bone: 'neck', k: NR * 0.7, sc: [...Nm, 0.72, 1, 1] }), RC(Nm, Hd, (NR * 1.45 + nTop) / 2, nTop, { bone: 'neck2', k: NR * 0.5, sc: [...Nm, 0.72, 1, 1] }));
  coat.push(E(lerp(Nb, Hd, 0.45), [NR * 0.55, NL * 0.45 + NR, NR * 0.6], { bone: 'neck', k: NR * 0.6, rot: [-(Math.PI / 2 - elev), 0, 0] }));
  // head
  const hr = [pitch, 0, 0];
  coat.push(
    E(hq(HL * 0.05, HH * 0.12), [HH * 0.5, HH * 0.5, HL * 0.36], { bone: 'head', rot: hr, k: HH * 0.25 }),
    E(hq(HL * 0.15, -HH * 0.22), [HH * 0.36, HH * 0.24, HL * 0.33], { bone: 'head', rot: hr, k: HH * 0.25 }),
  );
  if (SN > 0) {
    coat.push(RC(hq(HL * 0.25, -HH * 0.02), hq(HL * 0.42 + SN, -HH * (p.snoutFlat ? 0.05 : 0.14)), HH * 0.4, HH * (p.snoutFlat ? 0.36 : hoofed ? 0.33 : 0.27), { bone: 'head', k: HH * 0.2 }));
    for (const sx of [1, -1]) coat.push(S(hq(HL * 0.45 + SN * 0.98, -HH * 0.1, sx * HH * 0.11), HH * 0.06, { op: 's', k: HH * 0.04 }));
    coat.push(E(hq(HL * 0.38 + SN * 0.8, -HH * 0.36), [HH * 0.28, HH * 0.012, SN * 0.5 + HL * 0.1], { op: 's', k: HH * 0.03, rot: hr }));
  }
  for (const sx of [1, -1]) {
    coat.push(E(hq(-HL * 0.02, -HH * 0.08, sx * HH * 0.33), [HH * 0.16, HH * 0.24, HL * 0.2], { bone: 'head', k: HH * 0.15, rot: hr }));
    coat.push(S(hq(HL * 0.16, HH * 0.24, sx * HH * 0.4), HH * 0.12, { op: 's', k: HH * 0.08 }));
    const ES = p.earSize ?? 0.1, eb = hq(-HL * 0.12, HH * 0.42, sx * HH * 0.3);
    if (p.ears === 'pointy') coat.push(G([RC(eb, add(eb, [sx * ES * 0.25, ES, -ES * 0.25]), ES * 0.32, ES * 0.03), S(add(eb, [sx * ES * 0.1, ES * 0.45, ES * 0.12]), ES * 0.2, { op: 's', k: ES * 0.08 })], { bone: 'head', k: HH * 0.08 }));
    else if (p.ears === 'floppy') coat.push(E(add(eb, [sx * HH * 0.25, -ES * 0.55, 0]), [ES * 0.12, ES * 0.62, ES * 0.38], { bone: 'head', k: HH * 0.1, rot: [0, 0, sx * 0.25] }));
    else if (p.ears === 'round') coat.push(G([S(add(eb, [sx * ES * 0.1, ES * 0.35, 0]), ES * 0.55), S(add(eb, [sx * ES * 0.1, ES * 0.38, ES * 0.32]), ES * 0.35, { op: 's', k: ES * 0.1 })], { bone: 'head', k: HH * 0.08 }));
    else if (p.ears === 'side') coat.push(E(add(eb, [sx * ES * 0.65, -ES * 0.25, 0]), [ES * 0.7, ES * 0.22, ES * 0.38], { bone: 'head', k: HH * 0.06, rot: [0, 0, sx * -0.3] }));
    else if (p.ears === 'long') coat.push(E(add(eb, [sx * ES * 0.12, ES * 0.9, -ES * 0.1]), [ES * 0.2, ES * 0.95, ES * 0.08], { bone: 'head', k: HH * 0.06, rot: [-0.25, 0, sx * -0.12] }));
    else if (p.ears === 'big') coat.push(E(add(eb, [sx * ES * 0.4, -ES * 0.3, -HL * 0.1]), [ES * 0.08, ES * 0.95, ES * 0.75], { bone: 'head', k: HH * 0.08, rot: [0, sx * 0.4, 0] }));
  }
  // tail
  const tt = p.tail ?? 'thin', tb = (i) => `t${Math.min(2, i)}`;
  const tp = (k) => add(tailBase, tdir, TL * k);
  if (tt === 'thin' || tt === 'tuft') coat.push(RC(tp(0), tp(0.35), BH * 0.075, BH * 0.06, { bone: 't0', k: BH * 0.1 }), RC(tp(0.35), tp(0.7), BH * 0.06, BH * 0.045, { bone: 't1', k: BH * 0.04 }), RC(tp(0.7), tp(1), BH * 0.045, BH * 0.03, { bone: 't2', k: BH * 0.03 }));
  if (tt === 'bushy') coat.push(RC(tp(0), tp(0.2), BH * 0.08, BH * 0.1, { bone: 't0', k: BH * 0.1 }), E(tp(0.55), [BH * 0.2, BH * 0.2, TL * 0.47], { bone: 't1', k: BH * 0.12, rot: [-(p.tailUp ?? 0.3), 0, 0], n: [BH * 0.012, 18 / BH, 'groove'] }));
  if (tt === 'puff') coat.push(S(tp(0.1), BH * 0.17, { bone: 't0', k: BH * 0.06, n: [BH * 0.01, 40 / BH, 'curl'] }));
  if (tt === 'curl') coat.push(RC(tp(0), tp(0.6), BH * 0.04, BH * 0.03, { bone: 't0', k: BH * 0.03 }), RC(tp(0.6), add(tp(0.6), [0.04 * BH, TL * 0.4, 0]), BH * 0.03, BH * 0.02, { bone: 't1', k: BH * 0.02 }));
  if (tt === 'dragon') [0, 1, 2].forEach((i) => coat.push(RC(tp(i / 3), tp((i + 1) / 3), BH * 0.32 * (1 - i * 0.3), BH * 0.32 * (1 - (i + 1) * 0.3) + BH * 0.02, { bone: tb(i), k: BH * 0.1 })));
  if (tt === 'long' || tt === 'tuft') coat.push(RC(tp(0), tp(0.15), BH * 0.08, BH * 0.07, { bone: 't0', k: BH * 0.08 }));
  if (p.woolly) coat.forEach((n, i) => { if (i < 5) n.n = [BH * 0.03, 22 / BH, 'curl']; });
  if (p.scaly) coat.forEach((n) => { if (!n.n && n.op !== 's') n.n = [BH * 0.004, 140 / BH, 'curl']; });
  if (p.trunk) {
    const t0 = K.at.k0, t1 = K.at.k1, t2 = K.at.k2, tip = add(t2, [0, -HH * 0.5, HH * 0.25]);
    coat.push(RC(hq(HL * 0.3, -HH * 0.05), t0, HH * 0.32, HH * 0.24, { bone: 'head', k: HH * 0.2 }), RC(t0, t1, HH * 0.24, HH * 0.18, { bone: 'k0', k: HH * 0.05, n: [HH * 0.008, 60 / HH, 'vgroove'] }), RC(t1, t2, HH * 0.18, HH * 0.13, { bone: 'k1', k: HH * 0.04, n: [HH * 0.008, 60 / HH, 'vgroove'] }), RC(t2, tip, HH * 0.13, HH * 0.1, { bone: 'k2', k: HH * 0.03, n: [HH * 0.006, 60 / HH, 'vgroove'] }));
  }

  // --- coat painting: variation, countershading, spots, stripes, patches ---
  const coatC = new THREE.Color(p.coat ?? 0xb07a45), bellyC = new THREE.Color(p.belly ?? p.coat ?? 0xb07a45), accC = new THREE.Color(p.accent ?? 0x2a2420);
  const headC = p.headColor ? new THREE.Color(p.headColor) : null;
  if (v) coatC.offsetHSL((v() - 0.5) * 0.04, (v() - 0.5) * 0.1, (v() - 0.5) * 0.12);
  const seed = (p.variant ?? 0) * 13.7;
  const tipP = tp(0.95), tipC = new THREE.Color(p.tailTip ?? 0xffffff);
  const paint = (x, y, z, c, n) => {
    let col = coatC.clone();
    const under = Math.max(0, Math.min(1, (-n[1] - 0.1) * 1.6)) * (y < bodyY + BH * 0.1 ? 1 : 0.3);
    if (p.belly) col.lerp(bellyC, under);
    if (headC && (z > Nb[2] + NL * 0.3 || y < LEG * 0.75)) col = headC.clone();
    if (p.tailTip && Math.hypot(x - tipP[0], y - tipP[1], z - tipP[2]) < BH * 0.16) col = tipC.clone();
    const fx = x / BH, fy = y / BH, fz = z / BH;
    if (p.stripes && !headC) {
      const onLeg = y < LEG * 0.95, onHead = z > Nb[2] + NL * 0.2;
      const w = K.vnoise(fx * 2.5 + seed, fy * 2.5, fz * 2.5) * 2.2;
      const st = onLeg ? Math.sin(fy * 16 + w) : onHead ? Math.sin(fy * 22 + Math.abs(fx) * 12 + w) : Math.sin((z / L) * Math.PI * 2 * p.stripes + w + Math.abs(fx) * 1.5);
      const thr = onHead ? 0.82 : 0.6 + 0.25 * K.vnoise(fx * 6, fy * 6, fz * 6);
      if (st > thr && under < 0.5) col = accC.clone();
    }
    if (p.spots) {
      const [d1, d2] = K.worley(fx * 2.4 + seed, fy * 2.4, fz * 2.4);
      if (p.spots > 15) { if (d2 - d1 > 0.12 && y > LEG * 0.4) col = accC.clone().lerp(coatC, 0.1); } // giraffe-style patches
      else if (d1 < 0.32 + K.vnoise(fx * 6, fy * 6, fz * 6) * 0.15 && y > LEG * 0.6) col = accC.clone();
    }
    const tone = 0.93 + 0.14 * K.vnoise(fx * 4 + seed, fy * 4, fz * 4) + 0.04 * K.vnoise(fx * 30, fy * 30, fz * 30);
    c[0] = col.r * tone * c[0]; c[1] = col.g * tone * c[1]; c[2] = col.b * tone * c[2];
  };
  const furry = !p.scaly;
  const COAT = main || M(`q_coat_${p.scaly ? 'scale' : p.woolly ? 'wool' : 'fur'}`, furry
    ? { color: 0xffffff, roughness: p.woolly ? 1 : 0.85, sheen: 1, sheenRoughness: 0.55, sheenColor: 0x9a9a9a, vertexColors: true }
    : { color: 0xffffff, roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.45, vertexColors: true }, 'MeshPhysicalMaterial');
  const cellC = Math.max(L, BH * 2) * 0.0125;
  make(coat, cellC, COAT, { paint, paintKey: JSON.stringify([p.coat, p.belly, p.accent, p.stripes, p.spots, p.headColor, p.variant ?? 0, p.vary]) });

  // --- keratin: hooves, horns, tusks, claws, nose leather ---
  const ker = [];
  const KER = M(`q_keratin_${(p.hornColor ?? 0x2a2420).toString(16)}`, { color: 0xffffff, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.3, vertexColors: true }, 'MeshPhysicalMaterial');
  const tint = (c) => { const q = new THREE.Color(c); return [q.r, q.g, q.b]; };
  const hoofT = tint(0x2a2420), hornT = tint(p.hornColor ?? 0xe8dcc0), noseT = tint(p.nose ?? 0x1a1414);
  legs.forEach((l, i) => {
    if (hoofed) ker.push(RC([l.fet[0], LEG * 0.055, l.fet[2] + LR * 0.35], [l.fet[0], 0.004, l.fet[2] + LR * 0.6], LR * 0.85, LR * 1.08, { bone: `f${i}`, k: LR * 0.1, tint: hoofT }));
    else for (const dx of [-0.6, -0.2, 0.2, 0.6]) ker.push(RC([l.fet[0] + dx * LR, LR * 0.4, l.fet[2] + LR * 1.7], [l.fet[0] + dx * LR * 1.1, LR * 0.12, l.fet[2] + LR * 2.15], LR * 0.12, LR * 0.04, { bone: `f${i}`, k: LR * 0.02, tint: hoofT }));
  });
  if (SN > 0 && !p.trunk) ker.push(E(hq(HL * 0.43 + SN * 0.96, -HH * (p.snoutFlat ? 0.06 : 0.1)), [HH * (p.snoutFlat ? 0.3 : 0.16), HH * (p.snoutFlat ? 0.24 : 0.12), HH * 0.06], { bone: 'head', k: HH * 0.03, tint: noseT, rot: hr }));
  for (const sx of [1, -1]) {
    const base = hq(-HL * 0.05, HH * 0.42, sx * HH * 0.22);
    if (p.horns === 'short') ker.push(RC(base, add(base, [sx * HH * 0.35, HH * 0.4, -HH * 0.05]), HH * 0.09, HH * 0.02, { bone: 'head', k: HH * 0.04, tint: hornT }));
    if (p.horns === 'curved') { const a = add(base, [sx * HH * 0.2, HH * 0.35, -HH * 0.3]), b = add(a, [sx * HH * 0.15, HH * 0.05, -HH * 0.45]); ker.push(RC(base, a, HH * 0.12, HH * 0.08, { bone: 'head', k: HH * 0.04, tint: hornT, n: [HH * 0.006, 70 / HH, 'vgroove'] }), RC(a, b, HH * 0.08, HH * 0.015, { bone: 'head', k: HH * 0.03, tint: hornT })); }
    if (p.horns === 'antlers') {
      const a = add(base, [sx * HH * 0.25, HH * 0.6, -HH * 0.15]), b = add(a, [sx * HH * 0.2, HH * 0.6, -HH * 0.2]);
      ker.push(RC(base, a, HH * 0.06, HH * 0.045, { bone: 'head', k: HH * 0.03, tint: hornT }), RC(a, b, HH * 0.045, HH * 0.02, { bone: 'head', k: HH * 0.02, tint: hornT }), RC(a, add(a, [sx * HH * 0.05, HH * 0.35, HH * 0.25]), HH * 0.035, HH * 0.012, { bone: 'head', k: HH * 0.02, tint: hornT }), RC(lerp(base, a, 0.4), add(lerp(base, a, 0.4), [sx * HH * 0.1, HH * 0.25, HH * 0.3]), HH * 0.035, HH * 0.01, { bone: 'head', k: HH * 0.02, tint: hornT }), RC(b, add(b, [sx * HH * 0.18, HH * 0.15, HH * 0.1]), HH * 0.02, HH * 0.008, { bone: 'head', k: HH * 0.015, tint: hornT }));
    }
    if (p.horns === 'ossicones') ker.push(RC(base, add(base, [sx * HH * 0.05, HH * 0.45, -HH * 0.08]), HH * 0.06, HH * 0.07, { bone: 'head', k: HH * 0.04, tint: tint(p.coat ?? 0xe8b860) }));
    if (p.tusks) { const a = hq(HL * 0.4, -HH * 0.35, sx * HH * 0.18), b = add(a, [sx * HH * 0.1, -HH * 0.35, HH * 0.6]); ker.push(RC(a, b, HH * 0.075, HH * 0.03, { bone: 'head', k: HH * 0.03, tint: tint(0xf2ecdc) })); }
  }
  if (p.horns === 'unicorn') ker.push(RC(hq(HL * 0.12, HH * 0.42), hq(HL * 0.12 + HH * 1.1, HH * 1.5), HH * 0.11, HH * 0.01, { bone: 'head', k: HH * 0.04, tint: hornT, n: [HH * 0.008, 80 / HH, 'groove'] }));
  if (p.spikes) for (let i = 0; i < 9; i++) { const z = L * 0.38 - i * L * 0.11, y = bodyY + BH * 0.5 - Math.abs(z) * 0.08; ker.push(RC([0, y - BH * 0.05, z], [0, y + BH * 0.22, z - BH * 0.1], BH * 0.07, BH * 0.008, { bone: z > 0 ? 'chest' : 'hips', k: BH * 0.03, tint: tint(p.accent ?? 0x1d4f33) })); }
  make(ker, Math.max(L, BH * 2) * 0.006, KER, { ao: 0.5 });

  // --- hair: manes, long tails, tufts (strand grooves) ---
  const hairN = [];
  const HAIR = M(`q_hair_${(p.accent ?? 0x2a2420).toString(16)}`, { color: p.accent ?? 0x2a2420, roughness: 0.5, sheen: 1, sheenRoughness: 0.3, sheenColor: 0xbbbbbb, vertexColors: true }, 'MeshPhysicalMaterial');
  if (p.mane) {
    const poll = hq(-HL * 0.2, HH * 0.45);
    // a crest of hair along the top of the neck (thin, falling to one side) + a small forelock
    const crestA = add(Nm, [0, 0, 0]);
    const up = [0, Math.cos(elev), -Math.sin(elev)]; // perpendicular to the neck, pointing up/back
    hairN.push(RC(add(poll, up, -HH * 0.05), add(Nm, up, NR * 0.95), NR * 0.16, NR * 0.24, { bone: 'neck2', k: NR * 0.15, n: [NR * 0.03, 12 / NR, 'vgroove'] }));
    hairN.push(RC(add(crestA, up, NR * 0.95), add(Nb, up, NR * 1.25), NR * 0.24, NR * 0.3, { bone: 'neck', k: NR * 0.15, n: [NR * 0.03, 12 / NR, 'vgroove'] }));
    hairN.push(E(hq(HL * 0.12, HH * 0.42), [HH * 0.09, HH * 0.1, HH * 0.18], { bone: 'head', k: HH * 0.04, rot: hr, n: [HH * 0.015, 30 / HH, 'vgroove'] }));
  }
  if (p.lionMane) hairN.push(G([E(add(Hd, [0, -HH * 0.05, -HH * 0.35]), [HH * 1.0, HH * 1.0, HH * 0.85]), PL([0, 0, -1], add(Hd, [0, 0, HH * 0.1]), { k: HH * 0.15 })], { bone: 'neck2', n: [HH * 0.06, 9 / HH, 'curl'] }));
  if (tt === 'long') hairN.push(RC(tp(0.08), add(tp(0.08), [0, -TL * 0.95, -TL * 0.25]), BH * 0.1, BH * 0.16, { bone: 't0', k: BH * 0.05, n: [BH * 0.012, 30 / BH, 'groove'] }));
  if (tt === 'tuft') hairN.push(E(tp(1), [BH * 0.07, BH * 0.07, TL * 0.18], { bone: 't2', k: BH * 0.03, rot: [-(p.tailUp ?? 0.3), 0, 0], n: [BH * 0.01, 40 / BH, 'groove'] }));
  make(hairN, Math.max(L, BH * 2) * 0.008, HAIR, { ao: 0.7 });

  // --- wings (membrane or feathers), saddle ---
  const wing = [];
  if (p.wings) for (const [sx, nm] of [[1, 'L'], [-1, 'R']]) {
    const w0 = K.at[`w${nm}0`], w1 = K.at[`w${nm}1`], tip = add(w1, [sx * wingSpan * 0.55, BH * 0.1, -wingSpan * 0.08]);
    const memb = p.wings === 'membrane';
    wing.push(RC(w0, w1, BH * 0.06, BH * 0.045, { bone: `w${nm}0`, k: BH * 0.03 }), RC(w1, tip, BH * 0.045, BH * 0.015, { bone: `w${nm}1`, k: BH * 0.02 }));
    wing.push(G([E(lerp(w0, tip, 0.5), [wingSpan * 0.55, BH * 0.02, wingSpan * 0.3]), PL([0, 0, 1], add(w0, [0, 0, BH * 0.05])), ...(memb ? [S(add(lerp(w0, tip, 0.45), [0, 0, -wingSpan * 0.38]), wingSpan * 0.17, { op: 's', k: BH * 0.05 }), S(add(lerp(w0, tip, 0.8), [0, 0, -wingSpan * 0.33]), wingSpan * 0.12, { op: 's', k: BH * 0.05 })] : [])], { bone: `w${nm}1`, wk: wingSpan * 0.12, k: BH * 0.03, n: memb ? [BH * 0.004, 30 / BH, 'vgroove'] : [BH * 0.006, 40 / BH, 'vgroove'] }));
  }
  make(wing, Math.max(L, BH * 2) * 0.009, M(`q_wing_${(p.accent ?? 0x1d4f33).toString(16)}_${p.wings}`, { color: p.wings === 'feather' ? (p.coat ?? 0xf6f6f6) : (p.accent ?? 0x1d4f33), roughness: p.wings === 'feather' ? 0.85 : 0.6, sheen: 0.6, side: THREE.DoubleSide, vertexColors: true }, 'MeshPhysicalMaterial'), { ao: 0.6 });
  if (p.saddle) make([G([E([0, bodyY + BH * 0.42, L * 0.05], [BW * 0.56, BH * 0.15, L * 0.2]), E([0, bodyY + BH * 0.3, L * 0.05], [BW * 0.5, BH * 0.15, L * 0.19], { op: 's', k: BH * 0.02 })], { bone: 'body' }), E([0, bodyY + BH * 0.5, L * 0.15], [BW * 0.12, BH * 0.08, L * 0.05], { bone: 'body', k: BH * 0.04 })], Math.max(L, BH * 2) * 0.008, M('q_saddle', { color: 0x5a3418, roughness: 0.42, clearcoat: 0.4, vertexColors: true }, 'MeshPhysicalMaterial'));

  // --- eyes ---
  const pupil = /cat|fox|dragon|lion|tiger/.test(p.species ?? '') ? 'slit' : hoofed ? 'bar' : 'round';
  for (const sx of [1, -1]) {
    const c = hq(HL * 0.16, HH * 0.24, sx * HH * 0.37);
    K.eye(c, HH * 0.1, 'head', p.eye ?? (hoofed ? 0x3a2416 : 0x5a3418), pupil, [sx * 0.75, 0.05, 0.66]);
  }

  // ---- rig ----
  const legB = legs.map((l, i) => ({ u: bones[B[`u${i}`]], m: bones[B[`m${i}`]], f: bones[B[`f${i}`]], front: l.front }));
  const body = bones[B.body], neck = bones[B.neck], neck2 = bones[B.neck2], head = bones[B.head];
  const tail = [0, 1, 2].map((i) => bones[B[`t${i}`]]);
  const wingsB = p.wings ? ['L', 'R'].map((nm, i) => ({ a: bones[B[`w${nm}0`]], b: bones[B[`w${nm}1`]], s: i ? -1 : 1 })) : [];
  const trunk = p.trunk ? [0, 1, 2].map((i) => bones[B[`k${i}`]]) : [];
  root.userData.rig = (t, mode) => {
    for (const b of bones) b.rotation.set(0, 0, 0);
    const walk = mode === 'walk', run = mode === 'run', fly = mode === 'fly' && wingsB.length;
    const ph = t * (run ? 9 : 5.2), A = run ? 0.62 : 0.34;
    const offs = run ? [0, 0.35, Math.PI, Math.PI + 0.35] : [0, Math.PI, Math.PI * 1.5, Math.PI * 0.5];
    legB.forEach((l, i) => {
      if (walk || run) {
        const s = Math.sin(ph + offs[i]), c = Math.cos(ph + offs[i]);
        l.u.rotation.x = -s * A;
        l.m.rotation.x = (l.front ? 1 : -0.6) * Math.max(0, c) * A * 1.3;
        l.f.rotation.x = (l.front ? 0.9 : 1.1) * Math.max(0, c) * A * 1.1;
      }
      if (fly) { l.u.rotation.x = l.front ? -0.9 : 0.8; l.m.rotation.x = l.front ? 1.2 : -0.7; l.f.rotation.x = 0.6; }
    });
    body.position.y = bodyY + (walk || run ? Math.abs(Math.sin(ph)) * BH * (run ? 0.08 : 0.025) : Math.sin(t * 1.3) * BH * 0.006);
    body.rotation.x = run ? Math.sin(ph * 2) * 0.05 : 0;
    neck.rotation.x = (walk ? Math.sin(ph * 2) * 0.04 : run ? Math.sin(ph * 2) * 0.08 : Math.sin(t * 0.6) * 0.04);
    head.rotation.y = walk || run || fly ? 0 : Math.sin(t * 0.45) * 0.3;
    neck2.rotation.y = head.rotation.y * 0.5;
    const wag = Math.sin(t * (walk || run ? 6 : 2.5));
    tail.forEach((b, i) => { b.rotation.y = wag * (tt === 'long' ? 0.05 : 0.15) * (i + 1) * 0.6; b.rotation.x = (i ? 0.05 : 0) + (run ? 0.12 : 0); });
    wingsB.forEach(({ a, b, s }) => {
      if (fly) { a.rotation.z = s * Math.sin(t * 5) * 0.65; b.rotation.z = s * Math.sin(t * 5 - 0.6) * 0.45; }
      else { a.rotation.y = s * 1.2; a.rotation.z = s * 0.45; b.rotation.y = s * 0.9; b.rotation.z = -s * 0.3; } // folded back over the flanks
    });
    trunk.forEach((b, i) => { b.rotation.x = Math.sin(t * 1.2 - i * 0.6) * 0.12; b.rotation.z = Math.sin(t * 0.7 - i * 0.5) * 0.08; });
  };
  root.userData.saddle = { node: body, y: BH * 0.52, z: L * 0.05 };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------------- birds ----------------
function makeBird(THREE, M, p, main) {
  const s = p.size ?? 0.2, up = p.upright ?? 0, lod = p.lod === 'low' ? 2 : 1;
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const legLen = s * 0.3 * (p.legLen ?? 1), bodyY = legLen + s * 0.3;
  const ang = -up * 1.15; // body tilt (upright birds stand tall)
  const fwd = [0, -Math.sin(ang), Math.cos(ang)], upv = [0, Math.cos(ang), Math.sin(ang)];
  const bq = (f, u, x = 0) => [x, bodyY + fwd[1] * f + upv[1] * u, fwd[2] * f + upv[2] * u];
  const neckLen = s * 0.14 * (p.neckLen ?? 1);
  const neckB = bq(s * 0.36, s * 0.16), headP = add(neckB, [0, neckLen + s * 0.08, neckLen * 0.2 * (p.neckLen ?? 1) > s * 0.2 ? s * 0.1 : 0]);
  const span = s * 1.05 * (p.flightless ? 0.45 : 1);
  const spec = [['body', null, [0, bodyY, 0]], ['neck', 'body', neckB], ['head', 'neck', headP], ['tail', 'body', bq(-s * 0.45, s * 0.05)]];
  for (const [sx, nm] of [[1, 'L'], [-1, 'R']]) { const w0 = bq(s * 0.12, s * 0.16, sx * s * 0.24); spec.push([`w${nm}0`, 'body', w0], [`w${nm}1`, `w${nm}0`, add(w0, [sx * span * 0.42, 0, 0])]); }
  for (const [sx, nm] of [[1, 'L'], [-1, 'R']]) { const h = [sx * s * 0.09, legLen + s * 0.05, s * 0.02]; spec.push([`l${nm}`, 'body', h], [`k${nm}`, `l${nm}`, [h[0], legLen * 0.45, h[2] - s * 0.02]]); }
  const K = rigKit(M, spec, lod);
  const { E, S, RC, G, PL, make, root, bones, B } = K;
  const rot = [ang, 0, 0];
  const plum = [];
  plum.push(
    E([0, bodyY, 0], [s * 0.29, s * 0.3, s * 0.48], { bone: 'body', rot }),
    E(bq(s * 0.2, -s * 0.06), [s * 0.27, s * 0.27, s * 0.3], { bone: 'body', k: s * 0.15, rot }),
    RC(neckB, headP, s * 0.13, s * 0.11, { bone: 'neck', k: s * 0.1 }),
    S(add(headP, [0, s * 0.02, 0]), s * 0.16 * (p.bigEyes ? 1.25 : 1), { bone: 'head', k: s * 0.06 }),
    E(bq(-s * 0.5, s * 0.07), [s * 0.17, s * 0.03, s * 0.28 * (p.tailLen ?? 1)], { bone: 'tail', k: s * 0.08, rot: [ang + 0.2, 0, 0], n: [s * 0.006, 50 / s, 'vgroove'] }),
  );
  if (p.bigEyes) plum.push(E(add(headP, [0, 0, s * 0.11]), [s * 0.18, s * 0.15, s * 0.05], { bone: 'head', k: s * 0.05 }));
  if (p.ears) for (const sx of [1, -1]) plum.push(RC(add(headP, [sx * s * 0.09, s * 0.12, 0]), add(headP, [sx * s * 0.13, s * 0.27, -s * 0.02]), s * 0.04, s * 0.005, { bone: 'head', k: s * 0.03 }));
  for (const [sx, nm] of [[1, 'L'], [-1, 'R']]) {
    const w0 = K.at[`w${nm}0`], w1 = K.at[`w${nm}1`];
    plum.push(E(add(w0, [sx * span * 0.22, 0, -s * 0.06]), [span * 0.24, s * 0.028, s * 0.2], { bone: `w${nm}0`, k: s * 0.05, tint: [0.97, 0.97, 0.97] }));
    plum.push(G([E(add(w1, [sx * span * 0.28, 0, -s * 0.1]), [span * 0.32, s * 0.02, s * 0.2]), PL([0, 0, 1], add(w1, [0, 0, s * 0.08]))], { bone: `w${nm}1`, k: s * 0.04, n: [s * 0.005, 45 / s, 'vgroove'] }));
  }
  // plumage colouring: body / belly / head / wings with feather rows
  const cb = new THREE.Color(p.body ?? 0x3d77c2), cbel = new THREE.Color(p.belly ?? p.body ?? 0xf2e6d0), cw = new THREE.Color(p.wing ?? p.body ?? 0x2a5aa0), ch = new THREE.Color(p.head ?? p.body ?? 0x3d77c2);
  const paint = (x, y, z, c, n) => {
    let col;
    if (Math.abs(x) > s * 0.3) col = cw.clone().multiplyScalar(0.85 + 0.25 * Math.max(0, Math.sin(z / s * 40 + Math.abs(x) / s * 6)) ** 4);
    else if (y > headP[1] - s * 0.12 && z > neckB[2] - s * 0.05) col = ch.clone();
    else col = cb.clone().lerp(cbel, Math.max(0, Math.min(1, (-n[1] + 0.2) * 1.2 + (n[2] > 0.3 ? 0.3 : 0))));
    const k = 0.92 + 0.12 * K.vnoise(x / s * 9, y / s * 9, z / s * 9);
    c[0] *= col.r * k; c[1] *= col.g * k; c[2] *= col.b * k;
  };
  make(plum, s * 0.025, main || M('b_plumage', { color: 0xffffff, roughness: 0.8, sheen: 1, sheenRoughness: 0.4, sheenColor: 0x888888, vertexColors: true }, 'MeshPhysicalMaterial'), { paint, paintKey: JSON.stringify([p.body, p.belly, p.wing, p.head]) });
  // beak, legs, comb
  const tint = (c) => { const q = new THREE.Color(c); return [q.r, q.g, q.b]; };
  const bt = tint(p.beak ?? 0xf2b230), lt = tint(p.legs ?? 0xe08a30);
  const beakBase = add(headP, [0, 0, s * 0.14]), bl = s * (p.beakFlat ? 0.24 : p.beakHook ? 0.2 : 0.17);
  const ker = [];
  if (p.beakHook) ker.push(RC(beakBase, add(beakBase, [0, -s * 0.02, bl * 0.7]), s * 0.06, s * 0.035, { bone: 'head', k: s * 0.02, tint: bt }), RC(add(beakBase, [0, -s * 0.02, bl * 0.7]), add(beakBase, [0, -s * 0.1, bl * 0.85]), s * 0.035, s * 0.006, { bone: 'head', k: s * 0.015, tint: bt }));
  else ker.push(RC(beakBase, add(beakBase, [0, -s * 0.03, bl]), s * (p.beakFlat ? 0.06 : 0.05), s * (p.beakFlat ? 0.04 : 0.006), { bone: 'head', k: s * 0.02, tint: bt, sc: p.beakFlat ? [...beakBase, 1.35, 0.45, 1] : undefined }));
  if (p.comb) ker.push(E(add(headP, [0, s * 0.17, s * 0.03]), [s * 0.025, s * 0.07, s * 0.1], { bone: 'head', k: s * 0.02, tint: tint(0xc8201a), n: [s * 0.012, 60 / s, 'curl'] }));
  for (const nm of ['L', 'R']) {
    const h = K.at[`l${nm}`], kn = K.at[`k${nm}`], foot = [kn[0], s * 0.012, kn[2] + s * 0.02];
    ker.push(RC(h, kn, s * 0.035, s * 0.022, { bone: `l${nm}`, k: s * 0.01, tint: lt }), RC(kn, foot, s * 0.022, s * 0.018, { bone: `k${nm}`, k: s * 0.008, tint: lt }));
    for (const a of [-0.45, 0, 0.45, Math.PI]) ker.push(RC(foot, add(foot, [Math.sin(a) * s * 0.13, -s * 0.008, Math.cos(a) * s * (a === Math.PI ? 0.08 : 0.14)]), s * 0.014, s * 0.008, { bone: `k${nm}`, k: s * 0.006, tint: lt }));
  }
  make(ker, s * 0.012, M('b_keratin', { color: 0xffffff, roughness: 0.35, clearcoat: 0.6, vertexColors: true }, 'MeshPhysicalMaterial'), { ao: 0.5 });
  for (const sx of [1, -1]) K.eye(add(headP, [sx * s * (p.bigEyes ? 0.075 : 0.12), s * 0.06, s * (p.bigEyes ? 0.13 : 0.07)]), s * (p.bigEyes ? 0.06 : 0.035), 'head', p.eye ?? 0x2a1a0a, 'round', p.bigEyes ? [sx * 0.15, 0, 1] : [sx, 0.1, 0.3]);
  const [body, neck, head, tail, wL0, wL1, wR0, wR1, lL, kL, lR, kR] = ['body', 'neck', 'head', 'tail', 'wL0', 'wL1', 'wR0', 'wR1', 'lL', 'kL', 'lR', 'kR'].map((n) => bones[B[n]]);
  root.userData.rig = (t, mode) => {
    for (const b of bones) b.rotation.set(0, 0, 0);
    const fly = mode === 'fly' && !p.flightless, walk = mode === 'walk' || mode === 'run';
    for (const [w0, w1, sx] of [[wL0, wL1, 1], [wR0, wR1, -1]]) {
      if (fly) { w0.rotation.z = sx * Math.sin(t * 13) * 0.75; w1.rotation.z = sx * Math.sin(t * 13 - 0.7) * 0.5; }
      else if (p.flightless) { w0.rotation.z = -sx * (1.2 - (walk ? Math.sin(t * 8) * 0.2 : 0)); }
      else { w0.rotation.y = sx * 1.5; w0.rotation.z = -sx * 0.15; w1.rotation.y = sx * 0.08; w1.rotation.x = 0.05; } // folded back along the body
    }
    lL.rotation.x = fly ? 1.0 : walk ? Math.sin(t * 8) * 0.45 : 0; lR.rotation.x = fly ? 1.0 : walk ? -Math.sin(t * 8) * 0.45 : 0;
    kL.rotation.x = fly ? 1.2 : walk ? Math.max(0, Math.cos(t * 8)) * 0.6 : 0; kR.rotation.x = fly ? 1.2 : walk ? Math.max(0, -Math.cos(t * 8)) * 0.6 : 0;
    body.rotation.z = p.flightless && walk ? Math.sin(t * 8) * 0.12 : 0;
    body.position.y = bodyY + (walk ? Math.abs(Math.sin(t * 8)) * s * 0.03 : fly ? Math.sin(t * 13) * s * 0.04 : 0);
    neck.rotation.x = walk && !p.flightless ? Math.sin(t * 8) * 0.25 : 0;
    head.rotation.y = fly ? 0 : Math.sin(t * 0.9) * 0.7 * (Math.sin(t * 0.31) > 0 ? 1 : -0.6);
    head.rotation.x = fly ? -0.15 : Math.max(0, Math.sin(t * 2.3)) ** 8 * 0.5;
    tail.rotation.x = Math.sin(t * 1.7) * 0.06;
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------------- fish ----------------
function makeFish(THREE, M, p, main) {
  const L = p.length ?? 0.4, Hh = (p.height ?? 0.35) * L, W = (p.width ?? 0.16) * L, lod = p.lod === 'low' ? 2 : 1;
  const y0 = Hh * 0.7;
  const spec = [['b0', null, [0, y0, L * 0.12]], ['b1', 'b0', [0, y0, -L * 0.05]], ['b2', 'b1', [0, y0, -L * 0.22]], ['b3', 'b2', [0, y0, -L * 0.38]]];
  const K = rigKit(M, spec, lod);
  const { E, S, RC, G, PL, make, root, bones } = K;
  const fluke = !!p.fluke;
  const body = [
    E([0, y0, L * 0.1], [W * 0.5, Hh * 0.5, L * (p.pointy ? 0.4 : 0.34)], { bone: 'b0' }),
    E([0, y0 - Hh * 0.02, -L * 0.08], [W * 0.46, Hh * 0.46, L * 0.28], { bone: 'b1', k: Hh * 0.3 }),
    RC([0, y0, -L * 0.15], [0, y0 + Hh * (fluke ? 0 : 0.02), -L * 0.42], Hh * 0.32, Hh * 0.07, { bone: 'b2', k: Hh * 0.25, sc: [0, y0, -L * 0.28, W / Hh * 1.1, 1, 1] }),
  ];
  if (p.beak) body.push(RC([0, y0 - Hh * 0.08, L * 0.38], [0, y0 - Hh * 0.12, L * 0.52], Hh * 0.17, Hh * 0.08, { bone: 'b0', k: Hh * 0.12 }));
  body.push(E([0, y0 - Hh * (p.beak ? 0.15 : 0.08), L * (p.pointy ? 0.36 : 0.43)], [W * 0.35, Hh * 0.012, L * 0.06], { op: 's', k: Hh * 0.02 }));
  for (const sx of [1, -1]) body.push(G([RC([sx * W * 0.48, y0 + Hh * 0.25, L * 0.24], [sx * W * 0.48, y0 - Hh * 0.3, L * 0.22], Hh * 0.02, Hh * 0.02)], { op: 's', k: Hh * 0.02 }));
  if (p.pointy) for (let i = 0; i < 4; i++) for (const sx of [1, -1]) body.push(RC([sx * W * 0.46, y0 + Hh * 0.15, L * (0.2 - i * 0.04)], [sx * W * 0.46, y0 - Hh * 0.2, L * (0.19 - i * 0.04)], Hh * 0.008, Hh * 0.008, { op: 's', k: Hh * 0.006 }));
  const fins = [];
  const D = p.dorsal ?? 1, TS = p.tailSize ?? 1;
  fins.push(G([E([0, y0 + Hh * 0.45, -L * 0.02], [W * 0.06, Hh * 0.45 * D, L * 0.14]), PL([0, -1, 0], [0, y0 + Hh * 0.3, 0]), PL([0, -0.4, -1], [0, y0 + Hh * 0.6, L * 0.05])], { bone: 'b1', k: Hh * 0.05, n: [W * 0.02, 140 / L, 'vgroove'] }));
  if (fluke) fins.push(G([E([0, y0, -L * 0.47], [L * 0.16 * TS, Hh * 0.05, L * 0.08]), S([0, y0, -L * 0.55], L * 0.07, { op: 's', k: L * 0.02 })], { bone: 'b3', k: Hh * 0.05 }));
  else fins.push(G([E([0, y0 + Hh * 0.25 * TS, -L * 0.48], [W * 0.05, Hh * 0.38 * TS, L * 0.1], { rot: [0.45, 0, 0] }), E([0, y0 - Hh * 0.25 * TS, -L * 0.48], [W * 0.05, Hh * 0.38 * TS, L * 0.1], { rot: [-0.45, 0, 0] })], { bone: 'b3', k: Hh * 0.08, n: [W * 0.02, 140 / L, 'vgroove'] }));
  for (const sx of [1, -1]) fins.push(E([sx * W * 0.55, y0 - Hh * 0.18, L * 0.12], [W * 0.05, Hh * 0.12, L * 0.09], { bone: 'b0', k: Hh * 0.04, rot: [0.5, sx * 0.6, 0], n: [W * 0.01, 140 / L, 'vgroove'] }));
  if (!fluke) fins.push(E([0, y0 - Hh * 0.45, -L * 0.22], [W * 0.05, Hh * 0.18, L * 0.08], { bone: 'b2', k: Hh * 0.04, n: [W * 0.01, 140 / L, 'vgroove'] }));
  const cb = new THREE.Color(p.body ?? 0xf28c28), cbel = new THREE.Color(p.belly ?? p.body ?? 0xf5c87a), cf = new THREE.Color(p.fin ?? p.body ?? 0xf2a85a), cs = new THREE.Color(p.stripeColor ?? 0xffffff), csp = new THREE.Color(p.spotColor ?? 0xe0501a);
  const scales = !fluke && !p.pointy;
  const paint = (x, y, z, c, n) => {
    let col = cb.clone().lerp(cbel, Math.max(0, Math.min(1, (y0 - y) / (Hh * 0.35) + 0.3)));
    if (Math.abs(x) < W * 0.12 && (y > y0 + Hh * 0.35 || y < y0 - Hh * 0.35) || z < -L * 0.42) col = cf.clone();
    if (p.stripes) for (let i = 0; i < p.stripes; i++) if (Math.abs(z - L * (0.22 - i * 0.24)) < L * 0.035) col = cs.clone();
    if (p.spots) { const [d1] = K.worley(x / L * 8, y / L * 8, z / L * 8); if (d1 < 0.35) col = csp.clone(); }
    let k = 1;
    if (scales) { const u = z / (L * 0.03), w = y / (L * 0.03) + (Math.floor(u) % 2) * 0.5; k = 0.86 + 0.18 * Math.min(1, Math.hypot(u - Math.floor(u) - 0.5, w - Math.floor(w) - 0.5) * 1.6); }
    k *= 0.94 + 0.1 * K.vnoise(x / L * 20, y / L * 20, z / L * 20);
    c[0] *= col.r * k; c[1] *= col.g * k; c[2] *= col.b * k;
  };
  const SK = main || M(`f_skin_${scales ? 'scales' : 'smooth'}`, { color: 0xffffff, roughness: scales ? 0.28 : 0.45, clearcoat: scales ? 0.9 : 0.4, clearcoatRoughness: 0.2, iridescence: scales ? 0.35 : 0, vertexColors: true }, 'MeshPhysicalMaterial');
  make([...body, ...fins], L * 0.011, SK, { paint, paintKey: JSON.stringify([p.body, p.belly, p.fin, p.stripes, p.spots, p.stripeColor, p.spotColor]) });
  for (const sx of [1, -1]) K.eye([sx * W * 0.4, y0 + Hh * 0.1, L * (p.pointy ? 0.3 : 0.3)], Hh * (fluke || p.pointy ? 0.05 : 0.11), 'b0', fluke || p.pointy ? 0x111111 : 0xc8a040, 'round', [sx, 0, 0.25]);
  const bs = bones;
  root.userData.rig = (t, mode) => {
    const f = mode === 'swim' ? 7 : 2.5, a = mode === 'swim' ? 0.32 : 0.12;
    for (let i = 1; i < 4; i++) {
      const w = Math.sin(t * f * (fluke ? 0.6 : 1) - i * 0.9) * a * (0.25 + i * 0.3);
      if (fluke) { bs[i].rotation.x = w * 0.6; bs[i].rotation.y = 0; } else bs[i].rotation.y = w;
    }
    bs[0].rotation.y = fluke ? 0 : -Math.sin(t * f) * a * 0.15;
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------------- serpents (bone chain, slither wave) ----------------
function makeSerpent(THREE, M, p, main) {
  const L = p.length ?? 1.6, R = p.radius ?? 0.04, N = 10, lod = p.lod === 'low' ? 2 : 1;
  const spec = [];
  const seg = L / N;
  for (let i = 0; i <= N; i++) spec.push([`s${i}`, i ? `s${i - 1}` : null, [0, R, L / 2 - i * seg]]);
  const K = rigKit(M, spec, lod);
  const { E, S, RC, make, root, bones, at } = K;
  const nodes = [];
  const rad = (i) => R * (i < 1 ? 0.85 : Math.max(0.12, 1 - Math.max(0, i / N - 0.55) * 2));
  for (let i = 0; i < N; i++) nodes.push(RC(at[`s${i}`], at[`s${i + 1}`], rad(i), rad(i + 1), { bone: `s${i}`, k: R * 0.4 }));
  const hc = [0, R * 1.05, L / 2 + R * 0.9];
  if (!p.noEyes) {
    nodes.push(E(hc, [R * 1.25, R * 0.7, R * 1.6], { bone: 's0', k: R * 0.6 }));
    nodes.push(E([0, R * 0.85, L / 2 + R * 2.3], [R * 0.7, R * 0.5, R * 0.8], { bone: 's0', k: R * 0.5 }));
    for (const sx of [1, -1]) nodes.push(S([sx * R * 0.25, R * 1.0, L / 2 + R * 3.05], R * 0.1, { op: 's', k: R * 0.08 }));
    nodes.push(E([0, R * 0.62, L / 2 + R * 1.9], [R * 0.9, R * 0.04, R * 1.3], { op: 's', k: R * 0.06 }));
  } else nodes.push(S([0, R, L / 2], R * 0.85, { bone: 's0', k: R * 0.4 }));
  if (p.raised) nodes.push(E([0, R * 1.0, L / 2 - seg * 1.2], [R * 2.6, R * 0.35, seg * 0.9], { bone: 's1', k: R * 0.5 }));
  const c1 = new THREE.Color(p.body ?? 0x4a7a2a), c2 = new THREE.Color(p.accent ?? 0x2a4a1a), belly = new THREE.Color(0xe8dcb8);
  const paint = (x, y, z, c, n) => {
    const u = (L / 2 - z) / L;
    let col = c1.clone();
    if (p.bands && Math.sin(u * p.bands * Math.PI * 2) > 0.55) col = c2.clone();
    if (!p.bands && !p.noEyes) { const d = Math.abs(((u * 30) % 1) - 0.5) * 2 + Math.abs(x) / R * 0.6; if (d < 0.5) col = c2.clone(); }
    if (n[1] < -0.35) col.lerp(belly, 0.7);
    const sx = z / (R * 0.35), sy = Math.atan2(y - R, x) * 3 + (Math.floor(sx) % 2) * 0.5;
    const k = 0.84 + 0.2 * Math.min(1, Math.hypot(sx - Math.floor(sx) - 0.5, sy - Math.floor(sy) - 0.5) * 1.7);
    c[0] *= col.r * k; c[1] *= col.g * k; c[2] *= col.b * k;
  };
  make(nodes, R * 0.22, main || M('s_scales', { color: 0xffffff, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25, vertexColors: true }, 'MeshPhysicalMaterial'), { paint, paintKey: JSON.stringify([p.body, p.accent, p.bands, p.noEyes]) });
  if (!p.noEyes) for (const sx of [1, -1]) K.eye([sx * R * 0.82, R * 1.3, L / 2 + R * 1.75], R * 0.24, 's0', 0xc8a020, 'slit', [sx, 0.2, 0.4]);
  root.userData.rig = (t, mode) => {
    const moving = mode === 'slither' || mode === 'walk' || mode === 'swim';
    const f = moving ? 3 : 0.8, a = moving ? 0.38 : 0.12;
    bones.forEach((b, i) => { b.rotation.set(0, i ? Math.sin(t * f - i * 0.8) * a * Math.min(1, i / 2) : 0, 0); });
    if (p.raised) { bones[1].rotation.x = -0.75; bones[2].rotation.x = -0.35; bones[0].rotation.x = 0.95; }
  };
  root.userData.rig(0, 'idle');
  return root;
}

// ---------------- arthropods ----------------
function makeArthropod(THREE, M, p, main) {
  const s = p.size ?? 0.15, type = p.type ?? 'spider', lod = p.lod === 'low' ? 2 : 1;
  const add = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const by = s * 0.42;
  const nLegs = type === 'spider' || type === 'crab' ? 8 : 6, per = nLegs / 2;
  const spec = [['body', null, [0, by, 0]]];
  const legs = [];
  for (const sx of [1, -1]) for (let i = 0; i < per; i++) {
    const z = (per === 1 ? 0 : 0.5 - i / (per - 1)) * s * (type === 'spider' ? 0.42 : 0.55) + (type === 'spider' ? s * 0.25 : type === 'ant' ? s * 0.15 : 0);
    const a = sx * (Math.PI / 2) + (i - (per - 1) / 2) * -0.5 * sx;
    const reach = s * (type === 'spider' ? 0.85 : type === 'crab' ? 0.6 : 0.45);
    const hip = [sx * s * 0.16, by, z], knee = [hip[0] + Math.sin(a) * reach * 0.5, by + s * 0.3, z + Math.cos(a) * reach * 0.5], foot = [hip[0] + Math.sin(a) * reach, 0, z + Math.cos(a) * reach];
    const nm = `${sx > 0 ? 'L' : 'R'}${i}`;
    spec.push([`h${nm}`, 'body', hip], [`k${nm}`, `h${nm}`, knee]);
    legs.push({ nm, hip, knee, foot, i, sx });
  }
  if (type === 'scorpion') { let prev = 'body', pt = [0, by + s * 0.05, -s * 0.45]; for (let i = 0; i < 5; i++) { spec.push([`c${i}`, prev, pt]); prev = `c${i}`; pt = add(pt, [0, s * 0.16, -s * 0.07 + i * s * 0.045]); } }
  const K = rigKit(M, spec, lod);
  const { E, S, RC, G, make, root, bones, B, at } = K;
  const N = [];
  const hairy = type === 'spider' ? [s * 0.006, 260 / s, 'curl'] : undefined;
  if (type === 'spider') N.push(E([0, by, s * 0.22], [s * 0.26, s * 0.2, s * 0.3], { bone: 'body', n: hairy }), E([0, by + s * 0.12, -s * 0.38], [s * 0.42, s * 0.36, s * 0.5], { bone: 'body', k: s * 0.08, n: hairy }), RC([0, by, s * 0.48], [0, by - s * 0.08, s * 0.6], s * 0.06, s * 0.02, { bone: 'body', k: s * 0.03 }));
  if (type === 'ant') N.push(E([0, by + s * 0.08, s * 0.55], [s * 0.22, s * 0.2, s * 0.22], { bone: 'body' }), E([0, by, s * 0.15], [s * 0.14, s * 0.13, s * 0.26], { bone: 'body', k: s * 0.04 }), S([0, by + s * 0.02, -s * 0.15], s * 0.07, { bone: 'body', k: s * 0.04 }), E([0, by + s * 0.1, -s * 0.5], [s * 0.3, s * 0.27, s * 0.4], { bone: 'body', k: s * 0.04 }));
  if (type === 'beetle') N.push(G([E([0, by - s * 0.02, -s * 0.05], [s * 0.42, s * 0.38, s * 0.58]), E([0, by + s * 0.2, -s * 0.05], [s * 0.006, s * 0.3, s * 0.6], { op: 's', k: s * 0.01 })], { bone: 'body' }), E([0, by, s * 0.5], [s * 0.26, s * 0.17, s * 0.15], { bone: 'body', k: s * 0.05 }), E([0, by - s * 0.02, s * 0.7], [s * 0.17, s * 0.12, s * 0.12], { bone: 'body', k: s * 0.04 }));
  if (type === 'scorpion' || type === 'crab') {
    const wide = type === 'crab';
    N.push(E([0, by, 0], [s * (wide ? 0.6 : 0.3), s * 0.19, s * (wide ? 0.42 : 0.5)], { bone: 'body', n: wide ? [s * 0.008, 40 / s, 'curl'] : undefined }));
    for (const sx of [1, -1]) {
      const a = [sx * s * (wide ? 0.5 : 0.22), by, s * 0.4], b = add(a, [sx * s * 0.2, 0, s * 0.3]), c = add(b, [0, 0, s * 0.3]);
      N.push(RC(a, b, s * 0.05, s * 0.06, { bone: 'body', k: s * 0.03 }), E(c, [s * 0.12, s * 0.09, s * 0.2], { bone: 'body', k: s * 0.04 }), RC(add(c, [sx * -s * 0.04, 0, s * 0.15]), add(c, [sx * -s * 0.07, 0, s * 0.35]), s * 0.05, s * 0.01, { bone: 'body', k: s * 0.02 }), RC(add(c, [sx * s * 0.05, 0, s * 0.15]), add(c, [sx * s * 0.03, 0, s * 0.33]), s * 0.04, s * 0.008, { bone: 'body', k: s * 0.02 }));
    }
    if (type === 'scorpion') for (let i = 0; i < 5; i++) { const pp = at[`c${i}`], nx = i < 4 ? at[`c${i + 1}`] : add(pp, [0, s * 0.1, s * 0.12]); N.push(RC(pp, nx, s * 0.08 * (1 - i * 0.1), s * 0.07 * (1 - i * 0.1), { bone: `c${i}`, k: s * 0.03 })); }
  }
  for (const l of legs) {
    const r = s * (type === 'spider' ? 0.035 : type === 'crab' ? 0.045 : 0.025);
    N.push(RC(l.hip, l.knee, r, r * 0.85, { bone: `h${l.nm}`, k: r, n: hairy }), RC(l.knee, l.foot, r * 0.85, r * 0.35, { bone: `k${l.nm}`, k: r * 0.5, n: hairy }));
  }
  const cb = new THREE.Color(p.body ?? 0x1e1a18), ca = new THREE.Color(p.accent ?? 0xc0201a);
  const paint = (x, y, z, c, n) => {
    let col = cb.clone();
    if (p.dots) { const [d1] = K.worley(x / s * 5, y / s * 5, z / s * 5); if (d1 < 0.28 && y > by) col = ca.clone(); }
    if (type === 'spider' && z < -s * 0.2 && y > by + s * 0.25 && Math.abs(x) < s * 0.1 && Math.abs(z + s * 0.4) < s * 0.15) col = ca.clone();
    if (type === 'crab' && n[1] < -0.3) col.lerp(new THREE.Color(0xf0e0d0), 0.7);
    const k = 0.9 + 0.15 * K.vnoise(x / s * 12, y / s * 12, z / s * 12);
    c[0] *= col.r * k; c[1] *= col.g * k; c[2] *= col.b * k;
  };
  make(N, s * 0.016, main || M(`a_chitin_${type}`, { color: 0xffffff, roughness: type === 'spider' ? 0.55 : 0.22, clearcoat: type === 'spider' ? 0.2 : 1, clearcoatRoughness: 0.15, vertexColors: true }, 'MeshPhysicalMaterial'), { paint, paintKey: JSON.stringify([p.body, p.accent, p.dots, type]) });
  const eyeAt = type === 'spider' ? [0, by + s * 0.08, s * 0.5] : type === 'ant' ? [0, by + s * 0.12, s * 0.66] : type === 'beetle' ? [0, by + s * 0.02, s * 0.78] : [0, by + s * 0.2, s * 0.35];
  for (const sx of type === 'spider' ? [-1.5, -0.5, 0.5, 1.5] : [-1, 1]) K.eye(add(eyeAt, [sx * s * 0.06, 0, 0]), s * (type === 'spider' ? 0.03 : 0.045), 'body', 0x050505, 'round', [sx * 0.3, 0.2, 1]);
  root.userData.rig = (t, mode) => {
    const walk = mode === 'walk' || mode === 'run';
    legs.forEach((l) => {
      const hb = bones[B[`h${l.nm}`]], kb = bones[B[`k${l.nm}`]];
      const ph = t * 10 + (l.i + (l.sx > 0 ? 0 : 1)) * Math.PI;
      hb.rotation.set(0, walk ? Math.sin(ph) * 0.3 : Math.sin(t * 1.3 + l.i) * 0.02, 0);
      kb.rotation.set(walk ? Math.max(0, Math.cos(ph)) * -0.25 : 0, 0, 0);
    });
    bones[0].position.y = by + (walk ? Math.abs(Math.sin(t * 10)) * s * 0.02 : 0);
    if (type === 'scorpion') for (let i = 0; i < 5; i++) bones[B[`c${i}`]].rotation.x = Math.sin(t * 1.4 - i * 0.4) * 0.06;
  };
  root.userData.rig(0, 'idle');
  return root;
}

export const REAL_CREATURE_FACTORIES = { quadruped: makeQuadruped, bird: makeBird, fish: makeFish, serpent: makeSerpent, arthropod: makeArthropod };
