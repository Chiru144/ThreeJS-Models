// Realistic human: anatomy sculpted from blended signed-distance primitives (real
// adult proportions scaled by age/sex/build), skinned to a 17-bone skeleton.
// Copied into generated scenes via toString(); uses the sculpt() and rng() helpers.
/* eslint-disable no-undef */

function makeHuman(THREE, M, p, main) {
  const v = p.vary ? rng(4099 + (p.variant ?? 0) * 7919) : null;
  const pick = (a) => a[Math.floor(v() * a.length)];
  let sex = p.sex ?? 'neutral';
  if (v && p.varySex) sex = v() < 0.5 ? 'male' : 'female';
  const m = sex === 'male' ? 1 : sex === 'female' ? 0 : 0.6;
  const skinC = v && p.varySkin ? pick([0xf3d7c6, 0xeac3a6, 0xe0ac8a, 0xc68e6a, 0xb98a5e, 0xa8714c, 0x8d5a3b, 0x6b3f2a, 0x4a2a1c]) : p.skin ?? 0xc68e6a;
  const hairC = v && p.varyHair ? pick([0x16110d, 0x2e1d12, 0x5a3a20, 0xd8b56a, 0xa8401c, 0x6e3b1e]) : p.hairColor ?? 0x2e1d12;
  let hair = p.hair ?? (m < 0.5 ? 'long' : 'short');
  if (v && p.varyHair) hair = m < 0.5 ? pick(['long', 'ponytail', 'bun', 'bob', 'long']) : pick(['short', 'short', 'buzz', 'curly', 'short']);
  const CLOTH = [0x2f4f7f, 0x8c2f39, 0x2e6b4f, 0xd9c7a1, 0x444444, 0xe8e8e8, 0x6b4f8f, 0xc8742f, 0x1f2a44];
  const topC = v && p.varyClothes ? pick(CLOTH) : p.top ?? 0x2f4f7f;
  const botC = v && p.varyClothes ? pick([0x2b3a55, 0x3b3b3b, 0x5a4632, 0x1d1d22, 0x6d7a8a]) : p.bottom ?? 0x2b3a55;
  const outfit = p.outfit ?? 'casual';
  const lod = p.lod === 'low' ? 2.1 : 1;

  // ---- proportions (metres, from adult anthropometry, scaled) ----
  const H = p.height ?? 1.74;
  const jitter = v ? 0.95 + v() * 0.1 : 1; // per-person height: a root scale, so crowd members share geometry
  const HU = H / (p.headUnits ?? 7.5);
  const s = H / 1.75, hs = HU / 0.232;
  const ch = Math.min(1, Math.max(0, (7.3 - (p.headUnits ?? 7.5)) / 2.6)); // childness
  const adult = 1 - ch;
  const G = (p.girth ?? 1) * (outfit === 'spacesuit' ? 1.02 : 1), SH = p.shoulders ?? 1;
  const ath = SH > 1.1 ? 1 : 0;
  const legY = H * (p.legRatio ?? 0.5);
  const chinY = H - HU, shoulderY = H - HU * 1.36;
  const waistY = legY + (shoulderY - legY) * 0.36, chestY = shoulderY - (shoulderY - legY) * 0.27;
  const kneeY = legY * 0.53, ankleY = legY * 0.085;
  const shHalf = (0.172 + 0.03 * m) * s * SH * Math.sqrt(G);
  const hipHalf = (0.175 - 0.01 * m) * s * Math.pow(G, 1.1) * (1 + 0.06 * (1 - m) * adult);
  const Ga = Math.pow(G, 0.7) * (1 + 0.12 * ath);
  const a0 = 0.5; // bind in an A-pose (arms ~30° out) so sleeves and torso stay separate; the rig lowers them
  const restZ = a0 - 0.13; // how far the rig drops the arms for a natural standing pose
  const v3 = (x, y, z) => [x, y, z];
  const add3 = (a, b, k = 1) => [a[0] + b[0] * k, a[1] + b[1] * k, a[2] + b[2] * k];
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const norm3 = (a) => { const l = Math.hypot(...a); return a.map((q) => q / l); };
  const side = (sg) => {
    const J = v3(sg * (shHalf - 0.03 * s), shoulderY - 0.035 * s, -0.012 * s);
    const d = [sg * Math.sin(a0), -Math.cos(a0), 0];
    const E = add3(J, d, 0.18 * H);
    const d2 = norm3([d[0], d[1], 0.16]);
    const W = add3(E, d2, 0.148 * H);
    const Hj = v3(sg * 0.088 * s * Math.sqrt(G) * (1 + 0.05 * (1 - m)), legY, 0);
    // slightly open stance in the bind pose so the legs never fuse (thighs clear each other below the crotch)
    const K = v3(sg * 0.102 * s * Math.pow(G, 0.9), kneeY, 0.012 * s);
    const A = v3(sg * 0.108 * s * Math.pow(G, 0.9), ankleY, -0.012 * s);
    return { sg, J, d, E, d2, W, Hj, K, A };
  };
  const L = side(1), R = side(-1);
  const headC = v3(0, H - HU * 0.5, 0.004 * s);
  const hp = (x, y, z) => [headC[0] + x * hs, headC[1] + y * hs, headC[2] + z * hs]; // head-local -> world

  // ---- skeleton ----
  const BN = ['hips', 'spine', 'chest', 'neck', 'head', 'uaL', 'faL', 'hdL', 'uaR', 'faR', 'hdR', 'thL', 'shL', 'ftL', 'thR', 'shR', 'ftR'];
  const B = Object.fromEntries(BN.map((n, i) => [n, i]));
  const at = {
    hips: v3(0, legY, 0), spine: v3(0, waistY, 0), chest: v3(0, chestY, -0.01 * s), neck: v3(0, shoulderY + 0.02 * s, -0.012 * s), head: v3(0, chinY + 0.02 * s, 0),
    uaL: L.J, faL: L.E, hdL: L.W, uaR: R.J, faR: R.E, hdR: R.W, thL: L.Hj, shL: L.K, ftL: L.A, thR: R.Hj, shR: R.K, ftR: R.A,
  };
  const parent = { spine: 'hips', chest: 'spine', neck: 'chest', head: 'neck', uaL: 'chest', faL: 'uaL', hdL: 'faL', uaR: 'chest', faR: 'uaR', hdR: 'faR', thL: 'hips', shL: 'thL', ftL: 'shL', thR: 'hips', shR: 'thR', ftR: 'shR' };
  const bones = BN.map((n) => { const b = new THREE.Bone(); b.name = n; return b; });
  BN.forEach((n, i) => {
    const pw = parent[n] ? at[parent[n]] : [0, 0, 0];
    bones[i].position.set(at[n][0] - pw[0], at[n][1] - pw[1], at[n][2] - pw[2]);
    if (parent[n]) bones[B[parent[n]]].add(bones[i]);
  });
  const boneParents = BN.map((n) => (parent[n] ? B[parent[n]] : -1));
  const root = new THREE.Group();
  root.add(bones[0]);
  root.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(bones);

  // ---- sculpt node helpers ----
  const E = (c, r, o = {}) => ({ s: ['e', ...c, ...r], ...o });
  const S = (c, r, o = {}) => ({ s: ['s', ...c, r], ...o });
  const RC = (a, b, ra, rb, o = {}) => ({ s: ['rc', ...a, ...b, ra, rb], ...o });
  const RB = (c, h, r, o = {}) => ({ s: ['b', ...c, ...h, r], ...o });
  const PL = (n, pt, o = {}) => { const nn = norm3(n); return { s: ['p', ...nn, nn[0] * pt[0] + nn[1] * pt[1] + nn[2] * pt[2]], op: 'i', ...o }; };
  // head-local variants: radii in head units are scaled by hs
  const Eh = (c, r, o) => E(c, r.map((q) => q * hs), o);
  const Sh = (c, r, o) => S(c, r * hs, o);
  const RCh = (a, b, ra, rb, o) => RC(a, b, ra * hs, rb * hs, o);
  const RBh = (c, h, r, o) => RB(c, h.map((q) => q * hs), r * hs, o);
  const grow = (node, d) => {
    if (node.g) return { ...node, g: node.g.map((c) => (c.op === 'u' || !c.op ? grow(c, d) : c)) };
    const t = node.s[0], q = node.s.slice();
    if (t === 'e') { q[4] += d; q[5] += d; q[6] += d; } else if (t === 's') q[4] += d; else if (t === 'rc') { q[7] += d; q[8] += d; } else if (t === 'b') { q[4] += d; q[5] += d; q[6] += d; }
    return { ...node, s: q };
  };

  // ---- body anatomy (tagged by region so garments can reuse it) ----
  const tagged = [];
  let sideNow = 0;
  const T = (tag, node) => { tagged.push({ tag, node, side: sideNow }); return node; };
  const fem = (1 - m) * adult;
  T('torso', E(v3(0, chestY - 0.012 * s, -0.016 * s), [shHalf * 0.74, 0.175 * s, 0.112 * s * (0.85 + 0.15 * G)], { bone: B.chest }));
  T('torso', E(v3(0, shoulderY - 0.022 * s, -0.04 * s), [shHalf * 0.62, 0.06 * s, 0.07 * s], { bone: B.chest, k: 0.05 * s }));
  for (const sg of [1, -1]) {
    // pectorals: broad and flat (a plate over the ribcage, not a bulge)
    if (m > 0.5 || fem < 0.5) T('torso', E(v3(sg * 0.062 * s, chestY + 0.026 * s, 0.05 * s), [0.078 * s, 0.05 * s, (0.026 + 0.012 * ath) * s * adult + 0.008 * s], { bone: B.chest, k: 0.06 * s, rot: [0, 0, sg * 0.25] }));
    if (fem > 0.5) T('torso', S(v3(sg * 0.078 * s, chestY - 0.012 * s, 0.07 * s), 0.058 * s * (p.bust ?? 1), { bone: B.chest, k: 0.05 * s }));
    T('torso', RC(v3(sg * 0.02 * s, shoulderY + 0.004 * s, 0.038 * s), v3(sg * (shHalf - 0.03 * s), shoulderY + 0.012 * s, -0.004 * s), 0.013 * s, 0.014 * s, { bone: B.chest, k: 0.03 * s }));
  }
  T('waist', E(v3(0, waistY, 0.004 * s), [0.128 * s * Math.pow(G, 1.15) * (1 - 0.08 * fem), 0.13 * s, 0.094 * s * Math.pow(G, 1.25)], { bone: B.spine, k: 0.07 * s }));
  if (G > 1.15) T('waist', E(v3(0, waistY - 0.03 * s, 0.07 * s * (G - 1)), [0.12 * s * G, 0.11 * s * G, 0.09 * s * G], { bone: B.spine, k: 0.07 * s }));
  T('pelvis', E(v3(0, legY + 0.045 * s, -0.004 * s), [hipHalf, 0.11 * s, 0.104 * s * G], { bone: B.hips, k: 0.06 * s }));
  for (const sg of [1, -1]) T('pelvis', E(v3(sg * 0.064 * s, legY - 0.004 * s, -0.055 * s), [0.074 * s * G, 0.09 * s, 0.07 * s * G * (1 + 0.12 * fem)], { bone: B.hips, k: 0.045 * s }));
  T('neck', RC(v3(0, shoulderY - 0.03 * s, -0.018 * s), v3(0, chinY - 0.012 * s, -0.004 * s), (0.058 - 0.008 * (1 - m)) * s * (0.8 + 0.2 * ath + 0.2 * Math.min(G, 1.2)), (0.051 - 0.006 * (1 - m)) * s, { bone: B.neck, k: 0.045 * s }));
  for (const sd of [L, R]) {
    const { sg, J, d, E: El, W, Hj, K, A } = sd;
    sideNow = sg;
    const ua = sg > 0 ? B.uaL : B.uaR, fa = sg > 0 ? B.faL : B.faR, th = sg > 0 ? B.thL : B.thR, sh = sg > 0 ? B.shL : B.shR, ft = sg > 0 ? B.ftL : B.ftR;
    T('shoulder', E(add3(J, [sg * 0.012 * s, 0.006 * s, 0]), [0.052 * s * Ga, 0.07 * s, 0.058 * s * Ga], { bone: ua, k: 0.035 * s, rot: [0, 0, sg * 0.25] }));
    T('ua', RC(J, El, 0.046 * s * Ga, 0.035 * s, { bone: ua, k: 0.03 * s }));
    T('ua', E(add3(lerp3(J, El, 0.55), [0, 0, 0.018 * s]), [0.034 * s * Ga, 0.075 * s, 0.032 * s * Ga], { bone: ua, k: 0.03 * s, rot: [0, 0, sg * a0] }));
    T('ua', E(add3(lerp3(J, El, 0.45), [0, 0, -0.02 * s]), [0.034 * s * Ga, 0.08 * s, 0.032 * s * Ga], { bone: ua, k: 0.03 * s, rot: [0, 0, sg * a0] }));
    T('fa', S(add3(El, [0, 0, -0.01 * s]), 0.031 * s, { bone: fa, k: 0.02 * s }));
    T('fa', RC(El, W, 0.04 * s * Ga, 0.025 * s, { bone: fa, k: 0.02 * s }));
    T('fa', E(add3(lerp3(El, W, 0.25), [sg * 0.012 * s, 0, 0.012 * s]), [0.03 * s * Ga, 0.06 * s, 0.03 * s * Ga], { bone: fa, k: 0.03 * s }));
    T('thigh', RC(Hj, K, 0.083 * s * G, 0.052 * s, { bone: th, k: 0.05 * s }));
    T('thigh', E(add3(lerp3(Hj, K, 0.45), [sg * 0.006 * s, 0, 0.036 * s]), [0.055 * s * Math.pow(G, 0.8), 0.16 * s, 0.05 * s], { bone: th, k: 0.05 * s }));
    T('thigh', E(add3(K, [-sg * 0.022 * s, 0.075 * s, 0.024 * s]), [0.034 * s, 0.05 * s, 0.034 * s], { bone: th, k: 0.03 * s }));
    T('shin', S(add3(K, [0, 0.004 * s, 0.04 * s]), 0.025 * s, { bone: sh, k: 0.02 * s }));
    T('shin', RC(K, A, 0.05 * s, 0.03 * s, { bone: sh, k: 0.03 * s }));
    T('shin', E(add3(K, [0, -0.12 * s, -0.035 * s]), [0.046 * s * (1 - 0.1 * fem) * Math.pow(G, 0.7), 0.1 * s, 0.048 * s * Math.pow(G, 0.7)], { bone: sh, k: 0.04 * s }));
    T('foot', S(add3(A, [0.024 * s, 0, 0]), 0.018 * s, { bone: ft, k: 0.015 * s }));
    T('foot', S(add3(A, [-0.024 * s, 0, 0]), 0.018 * s, { bone: ft, k: 0.015 * s }));
    T('foot', S(v3(A[0], 0.036 * s, A[2] - 0.028 * s), 0.036 * s, { bone: ft, k: 0.02 * s }));
    T('foot', RB(v3(A[0] + sg * 0.004 * s, 0.032 * s, A[2] + 0.07 * s), [0.042 * s, 0.03 * s, 0.11 * s], 0.022 * s, { bone: ft, k: 0.03 * s }));
  }
  sideNow = 0;
  const parts = (...tags) => tagged.filter((t) => tags.includes(t.tag)).map((t) => t.node);
  const sideParts = (sg, ...tags) => tagged.filter((t) => t.side === sg && tags.includes(t.tag)).map((t) => t.node);

  // ---- head (finer grid) ----
  const NS = p.noseScale ?? 1, ES = (p.eyeScale ?? 1) * (1 + 0.18 * ch);
  const lipT = [1.13, 0.74, 0.74], cheekT = [1.05, 0.93, 0.92], stub = p.beard === 'stubble' ? [0.8, 0.79, 0.82] : null;
  const ey = 0.002 - 0.012 * ch, ex = 0.032, ez = 0.0715 + 0.004 * ch, er = 0.0122 * ES;
  const head = [
    Eh(hp(0, 0.02 + 0.01 * ch, -0.012), [0.076 * (1 + 0.04 * ch), 0.097, 0.098], { bone: B.head }),
    Eh(hp(0, -0.044, 0.015), [0.058 * (1 + 0.08 * m) * (1 - 0.12 * ch), 0.066 * (1 - 0.2 * ch), 0.07], { bone: B.head, k: 0.04 * hs, tint: stub }),
    Sh(hp(0, -0.097 + 0.018 * ch, 0.066 - 0.01 * ch), 0.021 * (1 + 0.12 * m), { bone: B.head, k: 0.025 * hs, tint: stub }),
    Eh(hp(0, 0.021, 0.08), [0.058, 0.0135 * (0.8 + 0.45 * m) * adult + 0.004, 0.02], { bone: B.head, k: 0.02 * hs }),
    Eh(hp(0, -0.055, 0.08), [0.02, 0.012, 0.012], { bone: B.head, k: 0.02 * hs }),
    Eh(hp(0, -0.0645 - 0.006 * ch, 0.0915), [0.0235, 0.0068, 0.0095], { bone: B.head, k: 0.008 * hs, tint: lipT }),
    Eh(hp(0, -0.0755 - 0.006 * ch, 0.089), [0.021, 0.0078 + 0.001 * (1 - m), 0.011], { bone: B.head, k: 0.008 * hs, tint: lipT }),
    Eh(hp(0, -0.0695 - 0.006 * ch, 0.099), [0.024, 0.0014, 0.012], { op: 's', k: 0.003 * hs }),
    RCh(hp(0, -0.008 - 0.01 * ch, 0.088), hp(0, -0.036 - 0.012 * ch, 0.104 - 0.006 * ch), 0.0085 * NS, 0.011 * NS, { bone: B.head, k: 0.01 * hs }),
    Sh(hp(0, -0.041 - 0.012 * ch, 0.103 - 0.006 * ch), 0.013 * NS, { bone: B.head, k: 0.008 * hs, tint: cheekT }),
    RCh(hp(0, -0.19, -0.022), hp(0, -0.06, -0.012), 0.047 * (1 - 0.1 * (1 - m)), 0.05, { bone: B.neck, k: 0.03 * hs }),
  ];
  for (const sg of [1, -1]) {
    head.push(
      Eh(hp(sg * 0.042, -0.022 - 0.008 * ch, 0.05), [0.034, 0.03, 0.03], { bone: B.head, k: 0.04 * hs, tint: cheekT }),
      Eh(hp(sg * 0.048, -0.008, 0.055), [0.02, 0.012, 0.018], { bone: B.head, k: 0.03 * hs }),
      m > 0.5 ? Sh(hp(sg * 0.048, -0.07, 0.0), 0.017, { bone: B.head, k: 0.045 * hs, tint: stub }) : null,
      Sh(hp(sg * ex, ey + 0.001, 0.086 + 0.004 * ch), 0.0168 * ES, { op: 's', k: 0.016 * hs }),
      { g: [Sh(hp(sg * ex, ey, ez), er + 0.0018), PL([0, -1, 0.22], hp(0, ey + 0.0024 * ES, ez))], k: 0.005 * hs, bone: B.head, tint: [0.93, 0.83, 0.83] },
      { g: [Sh(hp(sg * ex, ey, ez), er + 0.0012), PL([0, 1, 0.1], hp(0, ey - 0.0054 * ES, ez))], k: 0.005 * hs, bone: B.head, tint: [0.98, 0.88, 0.88] },
      Sh(hp(sg * 0.0145 * NS, -0.046 - 0.012 * ch, 0.092 - 0.006 * ch), 0.0095 * NS, { bone: B.head, k: 0.006 * hs, tint: cheekT }),
      Sh(hp(sg * 0.0075 * NS, -0.0515 - 0.012 * ch, 0.097 - 0.006 * ch), 0.0042 * NS, { op: 's', k: 0.003 * hs }),
      
    );
    if (p.ears === 'pointy') head.push(RCh(hp(sg * 0.072, -0.02, -0.008), hp(sg * 0.075 + sg * 0.05 * (p.earScale ?? 1), 0.05 * (p.earScale ?? 1), -0.035), 0.015, 0.002, { bone: B.head, k: 0.006 * hs }));
    else head.push(Eh(hp(sg * 0.076, -0.008, -0.008), [0.011, 0.031, 0.02], { bone: B.head, k: 0.006 * hs, rot: [0, sg * 0.35, 0] }), Sh(hp(sg * 0.077, -0.035, -0.004), 0.008, { bone: B.head, k: 0.006 * hs }));
    head.push(Sh(hp(sg * 0.084, -0.012, -0.002), 0.009, { op: 's', k: 0.004 * hs }));
  }
  if (p.tusks) for (const sg of [1, -1]) head.push(RCh(hp(sg * 0.02, -0.075, 0.085), hp(sg * 0.026, -0.04, 0.1), 0.007, 0.0015, { bone: B.head, k: 0.002 * hs, tint: [2.2, 2.1, 1.9] }));

  // ---- hands: palm + 4 fingers + thumb, finer grid ----
  const handNodes = (sd) => {
    const { sg, W, d2 } = sd;
    const hd = sg > 0 ? B.hdL : B.hdR, fa = sg > 0 ? B.faL : B.faR;
    const u = s * (1 - 0.1 * (1 - m));
    const palmC = add3(W, d2, 0.048 * u);
    const out = [
      RC(add3(W, d2, -0.04 * u), W, 0.026 * s, 0.024 * u, { bone: fa, k: 0.01 * u }),
      E(palmC, [0.016 * u, 0.05 * u, 0.042 * u], { bone: hd, k: 0.012 * u, rot: [0.16, 0, sg * a0] }),
      E(add3(palmC, [-sg * 0.006 * u, 0, 0.025 * u]), [0.014 * u, 0.03 * u, 0.02 * u], { bone: hd, k: 0.01 * u }),
    ];
    const knuck = add3(W, d2, 0.095 * u);
    [-0.026, -0.009, 0.008, 0.024].forEach((zz, i) => {
      const len = [0.068, 0.085, 0.09, 0.08][i] * u, r = [0.0075, 0.0085, 0.0088, 0.0085][i] * u;
      const base = add3(knuck, [0, 0.004 * u * (i === 0 || i === 3 ? 1 : 0), zz * u]);
      const mid = add3(base, norm3([d2[0] - sg * 0.12, d2[1], d2[2] * 0.6]), len * 0.55);
      const tip = add3(mid, norm3([d2[0] - sg * 0.45, d2[1] * 0.85, d2[2] * 0.4]), len * 0.45);
      out.push(RC(base, mid, r, r * 0.88, { bone: hd, k: 0.004 * u }), RC(mid, tip, r * 0.88, r * 0.75, { bone: hd, k: 0.003 * u, tint: [1.04, 0.95, 0.95] }));
    });
    const tb = add3(W, d2, 0.03 * u), tbase = add3(tb, [-sg * 0.012 * u, 0, 0.03 * u]);
    const tmid = add3(tbase, norm3([-sg * 0.25, -0.6, 0.75]), 0.035 * u);
    out.push(RC(tbase, tmid, 0.011 * u, 0.0095 * u, { bone: hd, k: 0.008 * u }), RC(tmid, add3(tmid, norm3([-sg * 0.35, -0.75, 0.4]), 0.03 * u), 0.0095 * u, 0.008 * u, { bone: hd, k: 0.004 * u }));
    return out;
  };

  // ---- materials ----
  const mkey = (n, c) => `hr_${n}_${c.toString(16)}`;
  const SKIN = M(mkey('skin', skinC), { color: skinC, roughness: 0.52, sheen: 0.35, sheenRoughness: 0.45, sheenColor: 0xffb8a0, vertexColors: true }, 'MeshPhysicalMaterial');
  const HAIR = M(mkey('hair', hairC), { color: hairC, roughness: 0.42, sheen: 1, sheenRoughness: 0.3, sheenColor: new THREE.Color(hairC).lerp(new THREE.Color(0xffffff), 0.35).getHex(), vertexColors: true }, 'MeshPhysicalMaterial');
  const cloth = (c, r = 0.88) => detailize(M(mkey(`cloth${r}`, c), { color: c, roughness: r, sheen: 0.6, sheenRoughness: 0.8, sheenColor: new THREE.Color(c).lerp(new THREE.Color(0xffffff), 0.3).getHex(), vertexColors: true }, 'MeshPhysicalMaterial'), r < 0.75 ? 'weave' : outfit === 'sweater' || outfit === 'hoodie' ? 'knit' : 'weave', (r < 0.75 ? 1400 : 900) / s, 0.8);
  const metal = (c, r = 0.28) => M(mkey(`metal${r}`, c), { color: c, roughness: r, metalness: 1, clearcoat: 0.3, vertexColors: true }, 'MeshPhysicalMaterial');
  const leather = (c) => detailize(M(mkey('leather', c), { color: c, roughness: 0.45, clearcoat: 0.35, clearcoatRoughness: 0.4, vertexColors: true }, 'MeshPhysicalMaterial'), 'leather', 260 / s, 0.7);
  detailize(SKIN, 'pores', 900 / s, 0.12);
  const armored = outfit === 'armor';
  const TOP = main || (armored ? metal(p.accent ?? 0xb8bcc4) : cloth(topC, outfit === 'suit' || outfit === 'royal' ? 0.7 : 0.9));
  const BOT = armored ? TOP : cloth(outfit === 'ninja' || outfit === 'uniform' || outfit === 'spacesuit' ? (p.bottom ?? topC) : botC, 0.92);
  const SHOE = leather(p.shoes ?? (outfit === 'spacesuit' ? 0xe8e8e8 : 0x2a2420));
  const ACC = outfit === 'armor' || outfit === 'royal' ? metal(p.accent ?? 0xc9a24a, 0.25) : cloth(p.accent ?? 0xc9a24a, 0.6);

  // ---- build: sculpt -> skinned meshes (geometry cached by shape) ----
  const cache = (sculpt.cache ||= new Map());
  const make = (nodes, cell, material, opts = {}) => {
    const list = nodes.filter(Boolean);
    if (!list.length) return null;
    const key = JSON.stringify([list, cell, opts.ao, lod, opts.paintKey]);
    let geo = cache.get(key);
    if (!geo) { geo = sculpt(list, { cell: cell * lod, ao: opts.ao ?? 1, paint: opts.paint, simplify: opts.simplify ?? 3.5, boneParents }); cache.set(key, geo); }
    const mesh = new THREE.SkinnedMesh(geo, material);
    mesh.frustumCulled = false;
    root.add(mesh);
    mesh.bind(skeleton, new THREE.Matrix4());
    return mesh;
  };
  const bodyCell = 0.0135 * s, headCell = 0.0047 * hs, handCell = 0.0042 * s;
  const merged = (list) => {
    // one skin mesh: body + head + hands (different resolutions, same material)
    const geos = list.map(([n0, c, ao = 1, simplify = 3.5]) => { const n = n0.filter(Boolean); const key = JSON.stringify([n, c, ao, lod, simplify]); let g = cache.get(key); if (!g) { g = sculpt(n, { cell: c * lod, ao, simplify, colorTol: 0.03, boneParents }); cache.set(key, g); } return g; });
    const out = new THREE.BufferGeometry();
    for (const name of ['position', 'normal', 'color', 'skinIndex', 'skinWeight']) {
      const arr = geos.map((g) => g.attributes[name].array);
      const C = arr[0].constructor, total = arr.reduce((t, a) => t + a.length, 0), buf = new C(total);
      let o = 0; for (const a of arr) { buf.set(a, o); o += a.length; }
      out.setAttribute(name, new THREE.BufferAttribute(buf, geos[0].attributes[name].itemSize, name === 'skinIndex' ? false : undefined));
    }
    const idx = []; let base = 0;
    for (const g of geos) { const ix = g.index.array; for (let i = 0; i < ix.length; i++) idx.push(ix[i] + base); base += g.attributes.position.count; }
    out.setIndex(idx);
    return out;
  };
  const skinKey = JSON.stringify(['skin', H.toFixed(3), HU.toFixed(3), m, G, SH, p.ears, p.tusks, NS, ES, p.beard, lod, outfit, p.shorts, p.skirt, p.archetype === 'queen' || p.archetype === 'princess']);
  let skinGeo = cache.get(skinKey);
  if (!skinGeo) {
    // only skin that clothing leaves visible is sculpted (the garments are sculpted from the same anatomy)
    const full = outfit === 'armor' || outfit === 'spacesuit' || outfit === 'ninja';
    const sleeves = { sport: 0, dress: 0, casual: 1, tshirt: 1, rags: 1 }[outfit] ?? 2;
    const legs = p.shorts || outfit === 'sport' ? 'knee' : outfit === 'dress' && !(p.archetype === 'queen' || p.archetype === 'princess') ? 'knee' : p.skirt ? 'knee' : 'none';
    const keep = (t) => t.tag === 'neck' || (!full && t.tag === 'fa' && sleeves < 2) || (!full && sleeves === 0 && (t.tag === 'ua' || t.tag === 'shoulder')) || (!full && sleeves === 1 && t.tag === 'ua') || (legs === 'knee' && t.tag === 'shin');
    const bodyNodes = tagged.filter(keep).map((t) => t.node);
    if (!full) bodyNodes.push({ g: [...parts('torso'), PL([0, -1, 0], v3(0, shoulderY - (sleeves === 0 ? 0.13 : 0.1) * s, 0))], k: 0.02 * s });
    if (legs === 'knee') for (const sg of [1, -1]) bodyNodes.push({ g: [...sideParts(sg, 'thigh'), PL([0, -1, 0], v3(0, kneeY + 0.03 * s, 0)), PL([0, 1, 0], v3(0, kneeY + 0.2 * s, 0))], k: 0.02 * s });
    skinGeo = merged([[bodyNodes, bodyCell], [head, headCell, 0.55, 2.2], [handNodes(L), handCell, 0.7, 3], [handNodes(R), handCell, 0.7, 3]]);
    cache.set(skinKey, skinGeo);
  }
  const skinMesh = new THREE.SkinnedMesh(skinGeo, SKIN);
  skinMesh.frustumCulled = false;
  root.add(skinMesh);
  skinMesh.bind(skeleton, new THREE.Matrix4());

  // ---- eyes (glossy, textured iris) + brows ----
  const eyeTex = (() => {
    const W = 64, Hh = 64, data = new Uint8Array(W * Hh * 4), ic = new THREE.Color(p.eyeColor ?? 0x5a3418);
    for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
      const th = (1 - y / (Hh - 1)) * Math.PI, u = x / W; // last row = front pole after rotateX
      let r = 0.86, gg = 0.83, b = 0.8;
      if (th > 0.6 && th < 1.4) { const vein = Math.max(0, Math.sin(u * 90 + th * 11)) ** 12 * 0.25 * (th - 0.6); gg -= vein; b -= vein; }
      if (th > 2.2) { r = 0.93; gg = 0.82; b = 0.8; }
      if (th < 0.52) {
        const fib = 0.75 + 0.25 * Math.sin(u * 120 + Math.sin(u * 37) * 3) * Math.sin(th * 40);
        const k = (th < 0.44 ? 1 : 0.5) * fib * (0.6 + 0.6 * (th / 0.52));
        r = ic.r * k; gg = ic.g * k; b = ic.b * k;
        if (th > 0.46) { r *= 0.4; gg *= 0.4; b *= 0.4; }
        if (th < 0.17) { r = gg = b = 0.02; }
      }
      const i = (x + y * W) * 4;
      data[i] = Math.round(Math.min(1, r) ** (1 / 2.2) * 255); data[i + 1] = Math.round(Math.min(1, gg) ** (1 / 2.2) * 255); data[i + 2] = Math.round(Math.min(1, b) ** (1 / 2.2) * 255); data[i + 3] = 255;
    }
    const t = new THREE.DataTexture(data, W, Hh); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
    return t;
  })();
  const EYE = M(`hr_eye_${(p.eyeColor ?? 0x5a3418).toString(16)}`, { map: eyeTex, roughness: 0.08, clearcoat: 1, clearcoatRoughness: 0.05 }, 'MeshPhysicalMaterial');
  const headBone = bones[B.head];
  const hb = at.head;
  for (const sg of [1, -1]) {
    const g = new THREE.SphereGeometry(er * hs, 24, 16); g.rotateX(Math.PI / 2);
    const e = new THREE.Mesh(g, EYE);
    const w = hp(sg * ex, ey, ez);
    e.position.set(w[0] - hb[0], w[1] - hb[1], w[2] - hb[2]);
    e.rotation.y = sg * -0.06;
    headBone.add(e);
    if (hair !== 'none') {
      const br = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 6), HAIR);
      const bw = hp(sg * 0.032, 0.0245 - 0.01 * ch, 0.0855);
      br.position.set(bw[0] - hb[0], bw[1] - hb[1], bw[2] - hb[2]);
      br.scale.set(0.02 * hs, (0.0026 + 0.001 * m) * hs, 0.005 * hs);
      br.rotation.set(-0.15, sg * 0.25, sg * -0.12);
      headBone.add(br);
    }
  }

  // ---- hair (sculpted, strand grooves) ----
  const capShell = (k = 1.08, extra = 0) => ({ g: [Eh(hp(0, 0.024, -0.012), [0.076 * k + extra, 0.097 * k + extra, 0.098 * k + extra]), PL([0, -1, 0.55], hp(0, 0.012 - 0.03 * (k - 1), 0), { k: 0.008 * hs })], bone: B.head });
  const hairNodes = [];
  const H2 = (n) => hairNodes.push(n);
  const strands = [0.0011 * hs, 85 / hs, 'groove'];
  const helmeted = ['astronaut', 'helmet', 'beanie', 'hood'].includes(p.hat) || outfit === 'ninja';
  if (!helmeted && hair !== 'bald') {
    if (hair === 'buzz') H2({ ...capShell(1.03), n: [0.0006 * hs, 300 / hs, 'curl'] });
    else if (hair === 'afro') H2({ ...capShell(1.38), n: [0.005 * hs, 140 / hs, 'curl'] });
    else if (hair === 'curly') H2({ ...capShell(1.15), n: [0.0035 * hs, 170 / hs, 'curl'] });
    else if (hair === 'mohawk') H2(RBh(hp(0, 0.08, -0.01), [0.012, 0.045, 0.1], 0.01, { bone: B.head, n: [0.002 * hs, 120 / hs, 'groove'] }));
    else {
      H2({ ...capShell(1.07), n: strands });
      if (hair === 'short' || hair === 'spiky') H2(Eh(hp(0, 0.07, 0.03), [0.062, 0.04, 0.07], { bone: B.head, k: 0.03 * hs, n: [0.0018 * hs, 70 / hs, 'groove'] }));
      if (hair === 'spiky') for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; H2(RCh(hp(Math.cos(a) * 0.04, 0.09, Math.sin(a) * 0.045 - 0.01), hp(Math.cos(a) * 0.07, 0.135, Math.sin(a) * 0.075 - 0.01), 0.018, 0.002, { bone: B.head, k: 0.01 * hs })); }
      if (hair === 'long') {
        H2({ g: [Eh(hp(0, -0.075, -0.05), [0.088, 0.17, 0.068]), PL([0, 0, 1], hp(0, 0, 0.02)), PL([0, -1, 0], hp(0, -0.24, 0))], k: 0.02 * hs, bone: B.head, n: strands });
        for (const sg of [1, -1]) H2({ g: [Eh(hp(sg * 0.072, -0.07, 0.005), [0.024, 0.14, 0.05])], k: 0.02 * hs, bone: B.head, n: strands });
      }
      if (hair === 'bob') H2({ g: [Eh(hp(0, -0.01, -0.01), [0.09, 0.108, 0.108]), PL([0, -1, 0], hp(0, -0.075, 0)), PL([0, 0, 1], hp(0, 0, 0.055))], k: 0.015 * hs, bone: B.head, n: strands });
      if (hair === 'ponytail') H2(RCh(hp(0, 0.01, -0.105), hp(0, -0.2, -0.13), 0.024, 0.011, { bone: B.head, k: 0.02 * hs, n: strands }));
      if (hair === 'bun') H2(Sh(hp(0, 0.065, -0.088), 0.035, { bone: B.head, k: 0.015 * hs, n: [0.0025 * hs, 150 / hs, 'curl'] }));
    }
  } else if (!helmeted && hair === 'bald' && p.age === 'elder') {
    H2({ ...capShell(1.04), g: [...capShell(1.04).g, PL([0, 1, 0], hp(0, 0.03, 0))], n: [0.0008 * hs, 300 / hs, 'curl'] });
  }
  const beard = p.beard ?? 'none';
  const old = p.age === 'elder' ? 1 : 0;
  if (beard === 'full') H2({ g: [Eh(hp(0, -0.078 - 0.02 * old, 0.025), [0.06, 0.062 + 0.035 * old, 0.075 + 0.01 * old]), PL([0, 1, -0.35], hp(0, -0.04, 0.06), { k: 0.008 * hs }), Eh(hp(0, -0.07, 0.1), [0.025, 0.012, 0.022], { op: 's', k: 0.008 * hs })], k: 0.008 * hs, bone: B.head, n: [0.0016 * hs, 120 / hs, 'groove'] });
  if (beard === 'goatee') H2(Eh(hp(0, -0.097, 0.07), [0.022, 0.026, 0.02], { bone: B.head, n: [0.0015 * hs, 160 / hs, 'curl'] }));
  if (beard === 'full' || beard === 'mustache' || beard === 'goatee') H2(Eh(hp(0, -0.058, 0.096), [0.028, 0.008, 0.012], { bone: B.head, k: 0.004 * hs, n: [0.001 * hs, 200 / hs, 'groove'] }));
  // strand streaks: lighter and darker locks running along the hair flow
  const strandPaint = (x, y, z, c) => { const a = Math.atan2(x - headC[0], z - headC[2]); const k = 0.82 + 0.3 * Math.max(0, Math.sin(a * 47 + y * 60 / s)) ** 3 + 0.06 * Math.sin(a * 131 + y * 210 / s); c[0] *= k; c[1] *= k; c[2] *= k; };
  make(hairNodes, headCell * 1.15, HAIR, { ao: 0.7, paint: strandPaint, paintKey: 'strands' });

  // ---- clothing (inflated anatomy + cuts), shoes, accessories ----
  const fold = [0.0028 * s, 55 / s, 'fold'];
  const grown = (tags, d) => parts(...tags).map((n) => grow(n, d));
  const armGroup = (sd, d, until, tags = ['shoulder', 'ua', 'fa'], extra = []) => {
    const cut = add3(sd.J, sd.d, until);
    const dir = until > 0.18 * H ? sd.d2 : sd.d;
    return { g: [...tagged.filter((t) => tags.includes(t.tag) && (t.node.bone === (sd.sg > 0 ? B.uaL : B.uaR) || t.node.bone === (sd.sg > 0 ? B.faL : B.faR))).map((t) => grow(t.node, d)), ...extra, PL(dir, until > 0.18 * H ? sd.W : cut)], k: 0.01 * s, n: fold };
  };
  const longSleeve = (d) => [L, R].map((sd) => armGroup(sd, d, 0.32 * H));
  const shortSleeve = (d) => [L, R].map((sd) => armGroup(sd, d + 0.004 * s, 0.1 * H, ['ua']));
  const torsoPiece = (d, bottomY, extra = []) => ({ g: [...grown(['torso', 'waist', 'pelvis'], d), ...extra, PL([0, -1, 0], v3(0, bottomY, 0))], k: 0.02 * s, n: fold });
  const pants = (d, bottomY, topY = waistY - 0.015 * s) => [
    { g: [...grown(['pelvis'], d), PL([0, 1, 0], v3(0, topY, 0))], k: 0.015 * s, n: [0.003 * s, 45 / s, 'fold'] },
    ...[1, -1].map((sg) => ({ g: [...sideParts(sg, 'thigh', 'shin').map((n) => grow(n, d)), PL([0, -1, 0], v3(0, bottomY, 0))], k: 0.03 * s, n: [0.003 * s, 45 / s, 'fold'] })),
  ];
  const skirt = (topY, botY, flare, d = 0.012 * s) => ({ g: [...grown(['pelvis'], d), RC(v3(0, topY, -0.008 * s), v3(0, botY, -0.008 * s), 0.13 * s * G + d, hipHalf * flare + d, { sc: [0, topY, -0.008 * s, 1, 1, 0.78] }), PL([0, 1, 0], v3(0, topY + 0.02 * s, 0)), PL([0, -1, 0], v3(0, botY, 0))], k: 0.06 * s, n: [0.0035 * s, 70 / s, 'vgroove'] });
  const neckHole = S(v3(0, shoulderY + 0.04 * s, 0.005 * s), 0.075 * s, { op: 's', k: 0.015 * s });
  const topNodes = [], botNodes = [], accNodes = [], shoeNodes = [];
  const hemTop = legY + 0.07 * s;
  if (outfit === 'casual' || outfit === 'tshirt' || outfit === 'rags') {
    topNodes.push({ ...torsoPiece(0.008 * s, outfit === 'rags' ? hemTop - 0.04 * s : hemTop, [neckHole]), ...(outfit === 'rags' ? { n: [0.006 * s, 30 / s, 'fold'] } : {}) }, ...shortSleeve(0.01 * s));
    botNodes.push(...pants(0.009 * s, ankleY + 0.03 * s));
  } else if (outfit === 'sport') {
    topNodes.push(torsoPiece(0.006 * s, hemTop, [neckHole, ...[L, R].map((sd) => S(add3(sd.J, [sd.sg * 0.03 * s, -0.02 * s, 0]), 0.075 * s, { op: 's', k: 0.02 * s }))]));
    botNodes.push(...pants(0.014 * s, kneeY + 0.1 * s));
  } else if (outfit === 'sweater' || outfit === 'hoodie' || outfit === 'ninja' || outfit === 'spacesuit') {
    const d = outfit === 'hoodie' ? 0.02 * s : outfit === 'spacesuit' ? 0.035 * s : 0.013 * s;
    topNodes.push(torsoPiece(d, legY + (outfit === 'ninja' || outfit === 'spacesuit' ? 0 : 0.03) * s, outfit === 'ninja' || outfit === 'spacesuit' ? [] : [neckHole]), ...longSleeve(d * 0.9));
    if (outfit === 'hoodie') topNodes.push(E(v3(0, shoulderY + 0.03 * s, -0.08 * s), [0.11 * s, 0.07 * s, 0.075 * s], { k: 0.04 * s }), RB(v3(0, waistY - 0.07 * s, 0.11 * s * G), [0.09 * s, 0.05 * s, 0.012 * s], 0.01 * s, { k: 0.02 * s }));
    if (outfit === 'spacesuit') for (const y of [waistY, chestY]) topNodes.push(RC(v3(-0.01, y, 0), v3(0.01, y, 0), 0.01, 0.01, { s: ['e', 0, y, 0, hipHalf * 1.3, 0.012 * s, 0.14 * s], k: 0.01 * s }));
    botNodes.push(...pants(d, ankleY + 0.03 * s));
  } else if (outfit === 'suit' || outfit === 'uniform' || outfit === 'labcoat' || outfit === 'royal') {
    const jacket = outfit === 'labcoat' ? 0.022 * s : 0.015 * s;
    const vcut = RC(v3(0, shoulderY + 0.06 * s, 0.13 * s), v3(0, chestY - 0.09 * s, 0.13 * s), 0.07 * s, 0.004 * s, { op: 's', k: 0.008 * s });
    topNodes.push(torsoPiece(jacket, outfit === 'labcoat' ? kneeY + 0.06 * s : outfit === 'royal' ? legY - 0.15 * s : legY - 0.04 * s, outfit === 'suit' ? [vcut] : [neckHole]), ...longSleeve(jacket * 0.9));
    if (outfit === 'suit') accNodes.push(...grown(['torso'], 0.004 * s).map((n) => ({ ...n, bone: B.chest })));
    botNodes.push(...pants(0.01 * s, ankleY + 0.03 * s));
  } else if (outfit === 'dress' || outfit === 'robe') {
    const long = outfit === 'robe' || p.archetype === 'queen' || p.archetype === 'princess';
    topNodes.push(torsoPiece(0.007 * s, waistY - 0.04 * s, [neckHole]), skirt(waistY - 0.02 * s, long ? ankleY + 0.02 * s : kneeY + 0.02 * s, long ? 1.75 : 1.45));
    if (outfit === 'robe') topNodes.push(...[L, R].map((sd) => ({ g: [RC(sd.J, add3(sd.W, sd.d2, 0.02 * s), 0.055 * s, 0.085 * s), PL(sd.d2, add3(sd.W, sd.d2, 0.02 * s))], k: 0.02 * s, n: fold })));
  } else if (outfit === 'armor') {
    const grooves = [0.33, 0.48, 0.62].map((t) => E(v3(0, legY + (shoulderY - legY) * t, 0), [shHalf * 1.2, 0.004 * s, 0.2 * s], { op: 's', k: 0.004 * s }));
    topNodes.push(torsoPiece(0.02 * s, legY - 0.08 * s, [neckHole, ...grooves]), ...longSleeve(0.015 * s));
    for (const sd of [L, R]) topNodes.push(E(add3(sd.J, [sd.sg * 0.02 * s, 0.025 * s, 0]), [0.085 * s, 0.06 * s, 0.085 * s], { bone: sd.sg > 0 ? B.uaL : B.uaR, k: 0.01 * s, rot: [0, 0, sd.sg * 0.35] }));
    botNodes.push(...pants(0.016 * s, ankleY + 0.04 * s));
    accNodes.push(RC(v3(0, legY + 0.06 * s, 0), v3(0, legY + 0.06 * s + 0.001, 0), hipHalf + 0.03 * s, hipHalf + 0.03 * s, { s: ['e', 0, legY + 0.07 * s, 0, hipHalf + 0.03 * s, 0.02 * s, 0.13 * s * G], bone: B.hips }));
  }
  if (p.shorts) { botNodes.length = 0; botNodes.push(...pants(0.014 * s, kneeY + 0.1 * s)); }
  if (p.skirt) { botNodes.length = 0; botNodes.push(skirt(waistY - 0.02 * s, kneeY + 0.06 * s, 1.4)); }
  if (p.cape) topNodes.push({ g: [E(v3(0, (shoulderY + kneeY) / 2, -0.03 * s), [shHalf * 1.08, (shoulderY - kneeY) / 2 + 0.06 * s, 0.17 * s * G]), E(v3(0, (shoulderY + kneeY) / 2 - 0.01 * s, -0.03 * s), [shHalf * 1.08 - 0.008 * s, (shoulderY - kneeY) / 2 + 0.07 * s, 0.17 * s * G - 0.008 * s], { op: 's' }), PL([0, 0, 1], v3(0, 0, -0.07 * s)), PL([0, -1, 0], v3(0, kneeY, 0))], bone: B.chest, n: [0.005 * s, 40 / s, 'vgroove'], tint: [1, 1, 1] });
  const boots = outfit === 'armor' || outfit === 'uniform' || outfit === 'spacesuit' || ['cowboy', 'pirate'].includes(p.hat);
  for (const sd of [L, R]) {
    const ft = sd.sg > 0 ? B.ftL : B.ftR;
    shoeNodes.push({ g: [...tagged.filter((t) => t.tag === 'foot' && t.node.bone === ft).map((t) => grow(t.node, 0.007 * s)), ...(boots ? tagged.filter((t) => t.tag === 'shin' && t.node.bone === (sd.sg > 0 ? B.shL : B.shR)).map((t) => grow(t.node, 0.011 * s)) : [RC(sd.A, add3(sd.A, [0, 0.04 * s, 0]), 0.04 * s, 0.038 * s, { bone: ft })]), PL([0, 1, 0], v3(0, boots ? kneeY - 0.06 * s : ankleY + 0.035 * s, 0))], k: 0.01 * s, bone: ft });
    shoeNodes.push({ g: [E(v3(sd.A[0] + sd.sg * 0.006 * s, 0.012 * s, sd.A[2] + 0.065 * s), [0.047 * s, 0.03 * s, 0.14 * s]), PL([0, 1, 0], v3(0, 0.014 * s, 0))], bone: ft, k: 0.008 * s, tint: [0.4, 0.38, 0.36] });
  }
  make(topNodes, bodyCell, TOP);
  make(botNodes, bodyCell, BOT);
  make(shoeNodes, bodyCell * 0.55, SHOE);
  make(accNodes, bodyCell * 0.9, outfit === 'suit' ? cloth(0xf2f2f2, 0.8) : ACC);
  if (outfit === 'suit') { // tie
    const tie = RC(v3(0, shoulderY + 0.005 * s, 0.112 * s), v3(0, waistY + 0.01 * s, 0.112 * s * Math.pow(G, 1.2) + 0.005 * s), 0.012 * s, 0.022 * s, { bone: B.chest, s: ['b', 0, (shoulderY + waistY) / 2 + 0.03 * s, 0.118 * s * Math.max(1, G), 0.02 * s, (shoulderY - waistY) / 2 - 0.02 * s, 0.004 * s, 0.003 * s] });
    make([tie], 0.004 * s, cloth(p.accent ?? 0x9c1f2a, 0.5));
  }

  // ---- hats ----
  const hat = p.hat ?? 'none';
  const top = H;
  const hatNodes = [];
  const hatMat = hat === 'crown' ? metal(0xffc356, 0.22) : hat === 'helmet' ? metal(p.accent ?? 0xa8adb6, 0.3) : hat === 'hardhat' ? M(mkey('hardhat', p.hatColor ?? 0xf2c230), { color: p.hatColor ?? 0xf2c230, roughness: 0.35, clearcoat: 0.6, vertexColors: true }, 'MeshPhysicalMaterial') : cloth(p.hatColor ?? (hat === 'wizard' ? topC : hat === 'chef' ? 0xffffff : hat === 'police' ? 0x1f2f55 : hat === 'tophat' || hat === 'pirate' ? 0x16141a : hat === 'cowboy' ? 0x8a5a2b : 0xc0392b), hat === 'tophat' ? 0.6 : 0.85);
  const HB = { bone: B.head };
  if (hat === 'cap' || hat === 'police') hatNodes.push({ g: [Eh(hp(0, 0.03, -0.012), [0.085, 0.104, 0.106]), PL([0, -1, 0], hp(0, 0.045, 0))], ...HB }, Eh(hp(0, 0.045, 0.1), [0.075, 0.006, 0.06], { ...HB, rot: [0.15, 0, 0] }));
  if (hat === 'police') hatNodes.push(RCh(hp(0, 0.06, 0), hp(0, 0.11, 0), 0.098, 0.105, HB));
  if (hat === 'tophat') hatNodes.push(Eh(hp(0, 0.075, 0), [0.15, 0.006, 0.13], HB), RCh(hp(0, 0.07, 0), hp(0, 0.24, 0), 0.08, 0.086, { ...HB, k: 0.005 * hs }));
  if (hat === 'wizard') hatNodes.push(Eh(hp(0, 0.065, 0), [0.19, 0.007, 0.19], HB), RCh(hp(0, 0.06, -0.01), hp(0, 0.2, -0.03), 0.095, 0.05, { ...HB, k: 0.02 * hs }), RCh(hp(0, 0.2, -0.03), hp(0, 0.34, -0.09), 0.05, 0.004, { ...HB, k: 0.02 * hs }));
  if (hat === 'crown') hatNodes.push({ g: [RCh(hp(0, 0.07, -0.01), hp(0, 0.12, -0.01), 0.082, 0.088), RCh(hp(0, 0.06, -0.01), hp(0, 0.13, -0.01), 0.074, 0.08, { op: 's' })], ...HB }, ...Array.from({ length: 8 }, (_, i) => { const a = (i / 8) * Math.PI * 2; return RCh(hp(Math.cos(a) * 0.084, 0.115, Math.sin(a) * 0.084 - 0.01), hp(Math.cos(a) * 0.088, 0.16, Math.sin(a) * 0.088 - 0.01), 0.012, 0.003, { ...HB, k: 0.004 * hs }); }));
  if (hat === 'helmet' || hat === 'hardhat') hatNodes.push({ g: [Eh(hp(0, 0.03, -0.012), [0.092, 0.112, 0.114]), PL([0, -1, 0], hp(0, hat === 'helmet' ? -0.01 : 0.03, 0))], ...HB });
  if (hat === 'helmet' && outfit === 'armor') hatNodes.push(RBh(hp(0, -0.02, 0.105), [0.006, 0.05, 0.008], 0.004, HB));
  if (hat === 'hardhat') hatNodes.push(Eh(hp(0, 0.035, 0.01), [0.12, 0.006, 0.13], HB));
  if (hat === 'cowboy') hatNodes.push({ g: [Eh(hp(0, 0.06, 0), [0.21, 0.04, 0.18]), Eh(hp(0, 0.03, 0), [0.21, 0.04, 0.18], { op: 's', k: 0.02 * hs }), Eh(hp(0, 0.08, 0), [0.25, 0.03, 0.2], { op: 'i' })], ...HB }, { g: [Eh(hp(0, 0.1, -0.005), [0.08, 0.075, 0.095]), PL([0, -1, 0], hp(0, 0.055, 0)), Eh(hp(0, 0.18, 0.0), [0.02, 0.03, 0.07], { op: 's', k: 0.02 * hs })], ...HB });
  if (hat === 'beanie') hatNodes.push({ g: [Eh(hp(0, 0.03, -0.012), [0.088, 0.108, 0.11]), PL([0, -1, 0], hp(0, 0.035, 0))], ...HB, n: [0.0015 * hs, 140 / hs, 'groove'] });
  if (hat === 'chef') hatNodes.push(RCh(hp(0, 0.06, 0), hp(0, 0.15, 0), 0.084, 0.088, HB), Eh(hp(0, 0.19, 0), [0.11, 0.06, 0.11], { ...HB, k: 0.02 * hs, n: [0.004 * hs, 90 / hs, 'curl'] }));
  if (hat === 'pirate') hatNodes.push({ g: [Eh(hp(0, 0.08, -0.005), [0.17, 0.06, 0.13]), Eh(hp(0, 0.05, -0.005), [0.16, 0.06, 0.12], { op: 's', k: 0.01 * hs })], ...HB }, { g: [Eh(hp(0, 0.05, -0.012), [0.085, 0.09, 0.105]), PL([0, -1, 0], hp(0, 0.06, 0))], ...HB });
  if (hat === 'hood' || outfit === 'ninja') hatNodes.push({ g: [Eh(hp(0, 0.0, -0.015), [0.1, 0.13, 0.12]), Eh(hp(0, -0.01, 0.07), [0.06, 0.09, 0.08], { op: 's', k: 0.02 * hs }), PL([0, -1, 0], hp(0, -0.16, 0))], ...HB, n: [0.002 * hs, 60 / hs, 'fold'] });
  make(hatNodes, headCell * 1.3, hat === 'hood' || outfit === 'ninja' ? TOP : hatMat);
  if (hat === 'astronaut') {
    const g = new THREE.Mesh(new THREE.SphereGeometry(0.17 * hs, 40, 30), M('hr_visor', { color: 0xdff2ff, roughness: 0.02, transmission: 0.92, thickness: 0.05, ior: 1.4, transparent: true, opacity: 0.55 }, 'MeshPhysicalMaterial'));
    const w = hp(0, 0.0, 0.01); g.position.set(w[0] - hb[0], w[1] - hb[1], w[2] - hb[2]);
    g.userData.noShadow = true;
    headBone.add(g);
  }

  // ---- props (rigid, parented to hand / forearm bones) ----
  const prop = p.prop ?? 'none';
  const STEEL = M('hr_steel', { color: 0xd8dce2, roughness: 0.18, metalness: 1, clearcoat: 0.4 }, 'MeshPhysicalMaterial');
  const WOOD = M('hr_wood', { color: 0x5a3a1e, roughness: 0.7 }, 'MeshPhysicalMaterial');
  const GOLD = M('hr_gold', { color: 0xffc356, roughness: 0.25, metalness: 1 }, 'MeshPhysicalMaterial');
  const handR = bones[B.hdR], handL = bones[B.hdL], foreL = bones[B.faL];
  const gripR = new THREE.Group(); gripR.position.set(0.012 * s, -0.08 * s, 0.035 * s); handR.add(gripR);
  const mesh = (geo, mat, x, y, z, parentObj) => { const o = new THREE.Mesh(geo, mat); o.position.set(x, y, z); parentObj.add(o); return o; };
  if (prop === 'sword' || prop === 'swordshield') {
    const sw = new THREE.Group(); sw.rotation.x = 1.25; gripR.add(sw);
    const blade = new THREE.CylinderGeometry(0.004 * s, 0.022 * s, 0.75 * s, 4, 1); blade.scale(1, 1, 0.25);
    mesh(blade, STEEL, 0, -0.43 * s, 0, sw).rotation.y = Math.PI / 4;
    mesh(new THREE.BoxGeometry(0.16 * s, 0.015 * s, 0.022 * s), GOLD, 0, -0.055 * s, 0, sw);
    mesh(new THREE.CylinderGeometry(0.014 * s, 0.016 * s, 0.11 * s, 10), M('hr_grip', { color: 0x2a1a10, roughness: 0.8 }, 'MeshPhysicalMaterial'), 0, 0.005 * s, 0, sw);
    mesh(new THREE.SphereGeometry(0.02 * s, 12, 10), GOLD, 0, 0.07 * s, 0, sw);
  }
  if (prop === 'shield' || prop === 'swordshield') {
    const sh = new THREE.Group(); sh.position.set(0.06 * s, -0.12 * s, 0.02 * s); sh.rotation.set(0, 0, Math.PI / 2); foreL.add(sh);
    const face = new THREE.SphereGeometry(0.6 * s, 40, 8, 0, Math.PI * 2, 0, 0.5); face.translate(0, -0.6 * s * Math.cos(0.5), 0); face.scale(1, 1.6, 1);
    mesh(face, M(`hr_shield_${(p.cape ?? 0x8c1d1d).toString(16)}`, { color: p.cape ?? 0x8c1d1d, roughness: 0.4, metalness: 0.15, clearcoat: 0.6, side: THREE.DoubleSide }, 'MeshPhysicalMaterial'), 0, 0, 0, sh).rotation.x = Math.PI;
    mesh(new THREE.TorusGeometry(0.6 * s * Math.sin(0.5), 0.011 * s, 8, 64), GOLD, 0, 0.002 * s, 0, sh).rotation.x = Math.PI / 2;
    mesh(new THREE.SphereGeometry(0.05 * s, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), GOLD, 0, -0.005 * s, 0, sh).rotation.x = Math.PI;
  }
  if (prop === 'staff') {
    const len = H * 1.05;
    const st = new THREE.Group(); st.rotation.x = 1.25; gripR.add(st); // undo the holding pose so the staff stands upright
    const g = new THREE.CylinderGeometry(0.014 * s, 0.018 * s, len, 10, 8);
    const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) pos.setX(i, pos.getX(i) + Math.sin(pos.getY(i) * 9) * 0.006 * s);
    g.computeVertexNormals();
    mesh(g, WOOD, 0, len * 0.5 - (at.hdR[1] - 0.08 * s), 0, st);
    mesh(new THREE.IcosahedronGeometry(0.045 * s, 3), M('hr_orb', { color: 0x9fe0ff, emissive: 0x3fb8ff, emissiveIntensity: 2.5, roughness: 0.05, transmission: 0.6, thickness: 0.05 }, 'MeshPhysicalMaterial'), 0, len - (at.hdR[1] - 0.08 * s) + 0.03 * s, 0, st);
  }
  if (prop === 'wand') { const w = new THREE.Group(); w.rotation.x = 1.3; gripR.add(w); mesh(new THREE.CylinderGeometry(0.003 * s, 0.006 * s, 0.3 * s, 8), WOOD, 0, -0.12 * s, 0, w); }
  if (prop === 'torch') { const t = new THREE.Group(); t.rotation.x = 0.9; gripR.add(t); mesh(new THREE.CylinderGeometry(0.016 * s, 0.012 * s, 0.4 * s, 8), WOOD, 0, -0.1 * s, 0, t); mesh(new THREE.ConeGeometry(0.04 * s, 0.12 * s, 10), M('hr_flame', { color: 0xffaa33, emissive: 0xff6a00, emissiveIntensity: 4 }), 0, -0.34 * s, 0, t).rotation.x = Math.PI; }
  if (prop === 'book') mesh(new THREE.BoxGeometry(0.03 * s, 0.22 * s, 0.16 * s), M('hr_book', { color: 0x6a1a2a, roughness: 0.6 }, 'MeshPhysicalMaterial'), -0.03 * s, -0.08 * s, 0.03 * s, handL);
  if (prop === 'briefcase') { const b = mesh(new THREE.BoxGeometry(0.1 * s, 0.3 * s, 0.42 * s), M('hr_case', { color: 0x3a2414, roughness: 0.4, clearcoat: 0.5 }, 'MeshPhysicalMaterial'), 0, -0.18 * s, 0, gripR); b.rotation.x = -0.1; }

  // ---- rig: idle / walk / run / wave / dance (+ zombie, ride poses) ----
  const [hips, spine, chest, neck, headB, uaL, faL, hdL, uaR, faR, hdR, thL, shL, ftL, thR, shR, ftR] = bones;
  const zombie = p.pose === 'zombie', riding = p.pose === 'ride', elder = p.age === 'elder';
  const rest = () => {
    for (const b of bones) b.rotation.set(0, 0, 0);
    hips.position.y = legY; hips.position.x = 0;
    uaL.rotation.z = -restZ; uaR.rotation.z = restZ;
    faL.rotation.x = faR.rotation.x = -0.08;
    if (elder) { spine.rotation.x = 0.06; chest.rotation.x = 0.08; neck.rotation.x = -0.1; }
    if (zombie) { uaL.rotation.x = uaR.rotation.x = -1.4; uaL.rotation.z -= 0.1; uaR.rotation.z += 0.1; headB.rotation.z = 0.2; }
    if (riding) { thL.rotation.set(-1.35, 0, 0.45); thR.rotation.set(-1.35, 0, -0.45); shL.rotation.x = shR.rotation.x = 1.4; ftL.rotation.x = ftR.rotation.x = -0.1; uaL.rotation.x = uaR.rotation.x = -0.5; faL.rotation.x = faR.rotation.x = -0.9; }
    if (prop === 'staff') { faR.rotation.x = -1.0; uaR.rotation.x = -0.25; }
    if (prop === 'swordshield' || prop === 'shield') { faL.rotation.x = -1.3; uaL.rotation.z += 0.15; }
    if (prop === 'sword' || prop === 'swordshield') faR.rotation.x = -0.35;
  };
  root.userData.rig = (t, mode) => {
    rest();
    const br = Math.sin(t * 1.6);
    if ((mode === 'walk' || mode === 'run') && !riding) {
      const run = mode === 'run', ph = t * (run ? 9 : 5.6), A = run ? 0.75 : 0.4;
      const sL = Math.sin(ph), cL = Math.cos(ph);
      thL.rotation.x = -sL * A; thR.rotation.x = sL * A;
      shL.rotation.x = Math.max(0, cL) * A * (run ? 2.2 : 1.5) + 0.05; shR.rotation.x = Math.max(0, -cL) * A * (run ? 2.2 : 1.5) + 0.05;
      ftL.rotation.x = -thL.rotation.x * 0.3 - (Math.max(0, cL) * 0.3); ftR.rotation.x = -thR.rotation.x * 0.3 - (Math.max(0, -cL) * 0.3);
      if (!zombie) { uaL.rotation.x = sL * A * 0.75; uaR.rotation.x = -sL * A * 0.75; faL.rotation.x = -0.15 - Math.max(0, sL) * 0.4 - (run ? 1.2 : 0); faR.rotation.x = -0.15 - Math.max(0, -sL) * 0.4 - (run ? 1.2 : 0); }
      hips.position.y = legY - (run ? 0.03 : 0.012) * s + Math.abs(cL) * (run ? 0.05 : 0.022) * s;
      hips.rotation.y = sL * 0.12; chest.rotation.y = -sL * 0.16;
      hips.rotation.z = cL * 0.035;
      spine.rotation.x += run ? 0.12 : 0.02; chest.rotation.x += run ? 0.06 : 0;
      headB.rotation.y = sL * 0.05;
    } else if (mode === 'wave') {
      uaR.rotation.z = -(2.52 - a0); uaR.rotation.x = -0.25; faR.rotation.z = -0.25 + Math.sin(t * 8) * 0.45; faR.rotation.x = -0.3;
      headB.rotation.z = 0.06; headB.rotation.x = -0.04;
      chest.rotation.x += br * 0.01; hips.rotation.z = 0.03;
    } else if (mode === 'dance') {
      const b = Math.sin(t * 5), c = Math.cos(t * 5);
      hips.rotation.z = b * 0.12; hips.position.y = legY - Math.abs(b) * 0.04 * s; chest.rotation.z = -b * 0.1;
      uaL.rotation.z = 2.17 - a0 + b * 0.4; uaR.rotation.z = -(2.17 - a0) + b * 0.4; faL.rotation.z = 0.6; faR.rotation.z = -0.6;
      thL.rotation.x = -Math.abs(b) * 0.25; thR.rotation.x = -Math.abs(c) * 0.25; shL.rotation.x = Math.abs(b) * 0.5; shR.rotation.x = Math.abs(c) * 0.5;
      headB.rotation.z = -b * 0.15;
    } else {
      chest.rotation.x += br * 0.012; spine.rotation.x += br * 0.006;
      uaL.rotation.z += br * 0.012; uaR.rotation.z -= br * 0.012;
      headB.rotation.y = Math.sin(t * 0.37) * 0.28; headB.rotation.x = Math.sin(t * 0.23) * 0.05;
      hips.rotation.z = Math.sin(t * 0.45) * 0.025; hips.position.x = Math.sin(t * 0.45) * 0.008 * s;
      thL.rotation.z = -hips.rotation.z; thR.rotation.z = -hips.rotation.z;
    }
  };
  root.scale.setScalar(jitter);
  root.userData.hipY = legY * jitter;
  root.userData.skeleton = skeleton;
  root.userData.rig(0, 'idle');
  return root;
}

export const REAL_HUMAN_FACTORY = makeHuman;
