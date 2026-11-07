import { Agent, SubAgent, assert } from '../core/agent.js';
import * as H from '../library/helpers.js';
import { MODELS, modelDefaults, sizeOf } from '../library/models.js';
import { LOCOMOTION_SPEEDS } from './animation.js';
import { THREE_VERSION, QUALITY } from '../library/presets.js';

const HEX_KEYS = new Set(['color', 'emissive', 'specularColor', 'sheenColor', 'attenuationColor', 'skin', 'hairColor', 'eyeColor', 'top', 'bottom', 'shoes', 'accent', 'hatColor', 'cape',
  'coat', 'belly', 'hornColor', 'nose', 'eye', 'headColor', 'tailTip', 'body', 'wing', 'head', 'beak', 'legs', 'fin', 'spotColor', 'stripeColor']);
const hex = (n) => `0x${(n >>> 0).toString(16).padStart(6, '0')}`;
const num = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1e4) / 1e4));

/** Compact JS literal with colours as hex. */
export function lit(v, key) {
  if (v === null || v === undefined) return 'undefined';
  if (typeof v === 'number') return HEX_KEYS.has(key) ? hex(v) : num(v);
  if (typeof v === 'boolean') return String(v);
  if (typeof v === 'string') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map((x) => lit(x)).join(', ')}]`;
  const entries = Object.entries(v).filter(([, x]) => x !== undefined);
  return entries.length ? `{ ${entries.map(([k, x]) => `${/^[a-z_$][\w$]*$/i.test(k) ? k : JSON.stringify(k)}: ${lit(x, k)}`).join(', ')} }` : '{}';
}

const indent = (src, pad = '  ') => src.split('\n').map((l) => (l ? pad + l : l)).join('\n');
const matExpr = (m) => (m ? `M('${m.key}', ${lit(m.props)}${m.type !== 'MeshStandardMaterial' ? `, '${m.type}'` : ''})` : 'undefined');

function helperBlock(needs) {
  const order = ['rng', 'heightAt', 'scatter', 'instanceize', 'mergeParts', 'sculpt', 'rigKit', 'surfaceTex', 'grassField'];
  return order.filter((h) => needs.has(h)).map((h) => indent(H[h].toString())).join('\n');
}

const MATERIAL_CACHE = `  const _mats = new Map();
  const M = (key, props, type = 'MeshStandardMaterial') => {
    if (!_mats.has(key)) _mats.set(key, new THREE[type](props));
    return _mats.get(key);
  };`;

/** scene.js: a renderer-agnostic ES module exporting createScene(THREE, opts). */
function emitModule(b) {
  const { spec, factories, materials, compose, lighting, animation } = b;
  const { layout, env, camera } = compose;
  const needs = new Set(['heightAt']);
  factories.forEach((f) => f.needs.forEach((n) => needs.add(n)));
  const byId = Object.fromEntries(layout.items.map((i) => [i.id, i]));
  const animById = Object.fromEntries(animation.bindings.map((a) => [a.id, a]));
  const L = [];
  const push = (s = '') => L.push(s);

  // lights
  const [sky, gnd, hi] = lighting.rig.hemi;
  push('  // Lighting');
  // outdoor scenes get image-based light from the physical sky, so the hemisphere fill is reduced
  const skyLit = ['daylight', 'sunset'].includes(lighting.rig.preset);
  push(`  scene.add(new THREE.HemisphereLight(${hex(sky)}, ${hex(gnd)}, ${num(skyLit ? hi * 0.25 : hi)}));`);
  for (const l of lighting.lights) {
    push('  {');
    if (l.type === 'DirectionalLight') {
      push(`    const l = new THREE.DirectionalLight(${hex(l.color)}, ${num(l.intensity)});`);
    } else {
      push(`    const l = new THREE.PointLight(${hex(l.color)}, ${num(l.intensity)}, ${num(l.distance ?? 0)}, 2);`);
    }
    push(`    l.position.set(${l.pos.map(num).join(', ')});`);
    if (l.shadow) {
      const s = l.shadow;
      push(`    l.castShadow = true;`);
      push(`    l.shadow.mapSize.set(${s.mapSize}, ${s.mapSize});`);
      push(`    Object.assign(l.shadow.camera, { left: -${s.half}, right: ${s.half}, top: ${s.half}, bottom: -${s.half}, near: 0.5, far: ${s.far} });`);
      push(`    l.shadow.bias = ${s.bias};`);
      push(`    l.shadow.normalBias = ${s.normalBias};`);
    }
    push(l.type === 'DirectionalLight' ? '    scene.add(l, l.target);' : '    scene.add(l);');
    push('  }');
  }

  if (env.autoGround && materials.ground) {
    push('  // Ground');
    push(`  scene.add(makeGround(THREE, M, { size: ${env.groundSize}, kind: '${spec.environment.ground}' }, ${matExpr(materials.ground)}));`);
    if (spec.environment.ground === 'grass' && spec.quality !== 'low') {
      needs.add('grassField').add('rng');
      const n = spec.quality === 'high' ? 45000 : 16000;
      push(`  scene.add(grassField(${n}, ${num(Math.min(28, layout.extent * 1.3 + 6))}, 0x6f9a3e, ${spec.seed}, ${lit(layout.occupied)}, ticks)); // wind-swept blades, 1 draw call`);
    }
  }

  const anyAnim = animation.bindings.length > 0;
  if (anyAnim) {
    push('');
    push('  const anims = [];');
    const loco = animation.bindings.some((x) => LOCOMOTION_SPEEDS[x.type]);
    if (loco) push(`  const LIN = ${lit(LOCOMOTION_SPEEDS)};`);
    push(`  const animate = (o, type, speed, amp, phase${loco ? ', stride = 0.5, inPlace = false' : ''}) => {
    const r = Math.hypot(o.position.x, o.position.z);
    anims.push({ o, type, speed, amp, phase, y: o.position.y, s: o.scale.x, r: r || 4, a: Math.atan2(o.position.z, o.position.x), rig: (o.children[0] || o).userData.rig${loco ? `,
      R: inPlace ? 0 : Math.max(r, stride * 2.5, 1.2), lin: (LIN[type] ?? 0) * Math.min(1.6, Math.max(0.2, stride * 2.2)), lift: inPlace ? stride * 0.6 : Math.max(1.2, stride * 3)` : ''} });
  };`);
  }
  const scattered = layout.items.some((i) => i.mode === 'scatter');
  L.unshift('  const ticks = [];');
  if (scattered) push(`  const occupied = ${lit(layout.occupied)};`);
  push('  const place = (child, x, y, z, ry, s) => { const g = new THREE.Group(); g.add(child); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); return g; };');

  const attachedTo = (id) => spec.objects.filter((c) => c.attach?.to === id);
  // Children (riders, companions) are emitted inside their parent's block so they inherit its motion.
  const emitAttached = (parentVar, o, pad) => {
    for (const c of attachedTo(o.id)) {
      const cfn = factories.find((f) => f.model === c.model).fnName;
      const ca = animById[c.id];
      const cs = num(c.scale / (o.scale || 1));
      push(`${pad}{ // ${c.id} ${c.attach.kind === 'rider' ? 'rides' : 'walks beside'} ${o.id}${c.sheet ? ` · ${c.sheet}` : ''}`);
      push(`${pad}  const c = place(${cfn}(THREE, M, ${lit({ ...modelDefaults(c.model), ...c.params })}, ${matExpr(materials.byId[c.id])}), 0, 0, 0, 0, ${cs});`);
      if (c.attach.kind === 'rider') {
        push(`${pad}  const sd = ${parentVar}.children[0].userData.saddle;`);
        push(`${pad}  c.position.set(0, sd.y - c.children[0].userData.hipY * ${cs} + 0.02, sd.z);`);
        push(`${pad}  sd.node.add(c);`);
      } else {
        push(`${pad}  c.position.set(${num(-(sizeOf(o).footprint + sizeOf(c).footprint) / (o.scale || 1) - 0.1)}, 0, 0.15);`);
        push(`${pad}  ${parentVar}.add(c);`);
      }
      push(`${pad}  c.name = '${c.id}';`);
      if (ca) push(`${pad}  animate(c, '${ca.type}', ${num(ca.speed)}, 0, 0.4${LOCOMOTION_SPEEDS[ca.type] ? ', 0.5, true' : ''});`);
      push(`${pad}}`);
    }
  };

  for (const o of spec.objects) {
    if (o.attach) continue;
    const item = byId[o.id];
    const fn = factories.find((f) => f.model === o.model).fnName;
    const params = lit({ ...modelDefaults(o.model), ...o.params });
    const mat = matExpr(materials.byId[o.id]);
    const a = animById[o.id];
    const variants = MODELS[o.model].variants && o.params.vary;
    const stride = LOCOMOTION_SPEEDS[a?.type] ? `, ${num(Math.round(sizeOf(o).footprint * 100) / 100)}${o.inPlace ? ', true' : ''}` : '';
    const anim = (target, phase) => (a ? `animate(${target}, '${a.type}', ${num(a.speed)}, ${num(a.amp ?? 0)}, ${phase}${stride});` : '');
    const P = (i) => (variants ? `{ ...p, variant: ${i} }` : 'p');
    push('');
    push(`  // ${o.id} · ${o.model}${o.params.species ? ` (${o.params.species})` : o.params.archetype && o.params.archetype !== 'person' ? ` (${o.params.archetype})` : ''} ×${o.count}${o.instanced ? ' (instanced)' : ''}`);
    if (o.sheet) push(`  // ${o.sheet}`);
    if (item.mode === 'backdrop' || item.mode === 'surface') {
      if (o.model === 'ground' && !env.autoGround) push(`  scene.add(${fn}(THREE, M, ${params}, ${mat}));`);
      else if (item.mode === 'backdrop') push(`  { const o = ${fn}(THREE, M, ${params}, ${mat}); o.name = '${o.id}'; scene.add(o);${a ? ` ${anim('o', 0)}` : ''} }`);
      else push(`  { const o = ${fn}(THREE, M, ${params}, ${mat}); o.name = '${o.id}'; scene.add(o); }`);
      continue;
    }
    push('  {');
    push(`    const p = ${params};`);
    if (item.mode === 'row') {
      const [px, py, pz] = item.positions[0];
      const single = item.positions.length === 1;
      const pad = single ? '    ' : '      ';
      if (!single) push(`    ${lit(item.positions)}.forEach(([px, py, pz], i) => {`);
      const X = single ? num(px) : 'px', Y = single ? num(py) : 'py', Z = single ? num(pz) : 'pz';
      const Yexpr = env.terrain.amp ? `heightAt(${X}, ${Z}) + ${Y}` : Y;
      push(`${pad}const o = place(${fn}(THREE, M, ${P(single ? 0 : 'i')}, ${mat}), ${X}, ${Yexpr}, ${Z}, ${num(o.rotationY)}, ${num(o.scale)});`);
      push(single ? `${pad}o.name = '${o.id}';` : `${pad}o.name = '${o.id}_' + i;`);
      push(`${pad}scene.add(o);`);
      if (a) push(`${pad}${anim('o', single ? 0 : 'i * 0.7')}`);
      if (single) emitAttached('o', o, pad);
      if (!single) push('    });');
      push('  }');
      continue;
    }
    const sc = item.scatter;
    push(`    const pts = scatter(${sc.count}, ${sc.inner}, ${sc.outer}, ${sc.minDist}, ${sc.seed}, occupied, ${sc.yJitter})${o.scale === 1 ? '' : `.map(([x, y, z, ry, s]) => [x, y, z, ry, s * ${num(o.scale)}])`};`);
    if (o.instanced) {
      needs.add('instanceize');
      if (variants) {
        // a few distinct looks, each instanced: variety without one draw call set per copy
        push('    const V = Math.min(4, pts.length);');
        push('    for (let v = 0; v < V; v++) {');
        push(`      const g = instanceize(${fn}(THREE, M, ${P('v')}, ${mat}), pts.filter((_, i) => i % V === v));`);
        push(`      g.name = '${o.id}_v' + v;`);
        push('      scene.add(g);');
        push('    }');
      } else {
        push(`    const g = instanceize(${fn}(THREE, M, p, ${mat}), pts);`);
        push(`    g.name = '${o.id}';`);
        push('    scene.add(g);');
        if (a) push(`    ${anim('g', 0)}`);
      }
    } else {
      push('    pts.forEach(([x, y, z, ry, s], i) => {');
      push(`      const o = place(${fn}(THREE, M, ${P('i')}, ${mat}), x, y, z, ry, s);`);
      push(`      o.name = '${o.id}_' + i;`);
      push('      scene.add(o);');
      if (a) push(`      ${anim('o', 'i * 0.7')}`);
      push('    });');
    }
    push('  }');
  }
  if (scattered) needs.add('scatter').add('rng');
  if (needs.has('grassField')) needs.add('surfaceTex');
  if (env.autoGround && materials.ground && !['matte', 'metal'].includes(spec.environment.ground)) needs.add('surfaceTex');
  if (lighting.enabled) {
    push('');
    push('  scene.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.noCast && !o.userData.noShadow; o.receiveShadow = !o.userData.noShadow; } });');
  }

  const bg = spec.environment.background ?? lighting.rig.background;
  const fog = lighting.rig.fog != null && spec.environment.fog && !layout.space
    ? `\n  scene.fog = new THREE.Fog(${hex(lighting.rig.fog)}, ${num(Math.max(20, layout.extent * 1.5))}, ${num(Math.max(80, layout.extent * 5 + 40))});` : '';
  const usedFactories = factories.filter((f) => spec.objects.some((o) => o.model === f.model) || (f.model === 'ground' && env.autoGround));
  const q = QUALITY[spec.quality];
  const key = lighting.lights.find((l) => l.type === 'DirectionalLight');
  const outdoor = ['daylight', 'sunset'].includes(lighting.rig.preset);
  const settings = {
    quality: spec.quality, shadows: lighting.enabled, exposure: lighting.rig.exposure, envMap: true, envIntensity: lighting.rig.envIntensity,
    pixelRatioCap: q.pixelRatioCap, antialias: q.antialias, target: camera.target, maxDistance: camera.maxDistance, maxPolar: camera.maxPolar,
    // physically based sky (outdoor) + post-processing (ambient occlusion, bloom)
    sky: outdoor && key ? { sun: key.dir, turbidity: lighting.rig.preset === 'sunset' ? 8 : 4, rayleigh: lighting.rig.preset === 'sunset' ? 3 : 1.2, mie: 0.005, mieG: 0.8, bg: lighting.rig.preset === 'sunset' ? 0.3 : 0.3, env: lighting.rig.preset === 'sunset' ? 0.16 : 0.18 } : null,
    post: { ao: spec.quality !== 'low', aoRadius: Math.max(0.15, Math.min(1.2, layout.heroHeight * 0.25)), bloom: spec.quality === 'high' || ['neon', 'night'].includes(lighting.rig.preset) },
  };

  return `// ${spec.title}
// Generated by threejs-forge-mcp for three.js r${THREE_VERSION.split('.')[1]} · quality: ${spec.quality}
// Renderer-agnostic: import * as THREE from 'three'; const app = createScene(THREE);
// then each frame: app.update(elapsedSeconds, deltaSeconds); renderer.render(app.scene, app.camera).
export function createScene(THREE, opts = {}) {
  const TERRAIN = ${lit(env.terrain)};
${MATERIAL_CACHE}
${helperBlock(needs)}
${usedFactories.map((f) => indent(f.source)).join('\n')}

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(${hex(bg)});${fog}

${L.join('\n')}

  const camera = new THREE.PerspectiveCamera(${camera.fov}, opts.aspect ?? 16 / 9, ${camera.near}, ${camera.far});
  camera.position.set(${camera.position.map(num).join(', ')});
  camera.lookAt(${camera.target.map(num).join(', ')});

${animation.update.replace('function update', 'function update')}
  function dispose() {
    scene.traverse((o) => {
      o.geometry?.dispose();
      if (o.material) [].concat(o.material).forEach((m) => m.dispose());
    });
  }

  return { scene, camera, update: (t, dt) => { update(t, dt); for (const f of ticks) f(t, dt); }, dispose, settings: ${lit(settings)} };
}
`;
}

/** index.html: self-contained page (works from file://) that renders the module. */
function emitHtml({ title, moduleSource }) {
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const inline = moduleSource.replace(/^export function createScene/m, 'function createScene').replace(/<\/script/gi, '<\\/script');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<style>
  html, body { margin: 0; height: 100%; overflow: hidden; background: #000; }
  canvas { display: block; touch-action: none; }
  #hint { position: fixed; left: 12px; bottom: 10px; font: 12px/1.4 system-ui, sans-serif; color: #fff8; pointer-events: none; }
</style>
<script type="importmap">
{ "imports": {
  "three": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/examples/jsm/"
} }
</script>
</head>
<body>
<div id="hint">drag to orbit · scroll to zoom · right-drag to pan</div>
<div id="loading" style="position:fixed;inset:0;display:grid;place-items:center;font:14px system-ui,sans-serif;color:#fffc;background:#111">sculpting models…</div>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

${inline}
await new Promise((r) => requestAnimationFrame(() => setTimeout(r))); // let the loading screen paint first
const app = createScene(THREE, { aspect: innerWidth / innerHeight });
document.getElementById('loading').remove();
const { scene, camera, settings } = app;

const renderer = new THREE.WebGLRenderer({ antialias: settings.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, settings.pixelRatioCap));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = settings.exposure * (settings.sky ? 0.85 : 1);
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

if (settings.sky) {
  // physically based sky: used as the background and to light the scene (image-based lighting)
  const sky = new Sky();
  sky.scale.setScalar(1000);
  const u = sky.material.uniforms;
  u.turbidity.value = settings.sky.turbidity; u.rayleigh.value = settings.sky.rayleigh;
  u.mieCoefficient.value = settings.sky.mie; u.mieDirectionalG.value = settings.sky.mieG;
  u.sunPosition.value.fromArray(settings.sky.sun).normalize();
  const envScene = new THREE.Scene();
  envScene.add(sky);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = pmrem.fromScene(envScene, 0).texture;
  scene.background = env;
  scene.backgroundIntensity = settings.sky.bg;
  scene.environment = env;
  scene.environmentIntensity = settings.sky.env;
  pmrem.dispose();
} else if (settings.envMap) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = settings.envIntensity;
  pmrem.dispose();
}

let composer = null;
if (settings.post.ao || settings.post.bloom) {
  const target = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: settings.antialias ? 4 : 0 });
  composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.addPass(new RenderPass(scene, camera));
  if (settings.post.ao) {
    const ao = new GTAOPass(scene, camera, innerWidth, innerHeight);
    ao.updateGtaoMaterial({ radius: settings.post.aoRadius, distanceExponent: 1, thickness: 1, scale: 1 });
    ao.blendIntensity = 0.8;
    composer.addPass(ao);
  }
  if (settings.post.bloom) composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.4, 3.0)); // only emissive highlights bloom
  composer.addPass(new OutputPass());
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.fromArray(settings.target);
controls.maxDistance = settings.maxDistance;
controls.maxPolarAngle = settings.maxPolar;
controls.update();

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer?.setSize(innerWidth, innerHeight);
});

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop((time) => {
  timer.update(time);
  app.update(timer.getElapsed(), Math.min(timer.getDelta(), 0.1));
  controls.update();
  if (composer) composer.render(); else renderer.render(scene, camera);
});
</script>
</body>
</html>
`;
}

/** model.js: a single reusable model factory module. */
function emitModel({ model, factory, material, params, sheet }) {
  const needs = new Set(factory.needs);
  const rig = MODELS[model].rigged ? `\n// Rigged: const m = createModel(THREE); each frame m.userData.rig(seconds, 'idle' | 'walk' | 'run' | ${model === 'human' ? "'wave' | 'dance'" : "'fly' | 'swim' | 'slither'"});` : '';
  return `// ${model}${sheet ? ` — ${sheet}` : ''}
// Generated by threejs-forge-mcp for three.js r${THREE_VERSION.split('.')[1]}
// import * as THREE from 'three'; scene.add(createModel(THREE, { /* params */ }));${rig}
// Params: ${Object.entries(MODELS[model].params).map(([k, v]) => `${k}=${v.default}`).join(', ')}
export function createModel(THREE, params = {}) {
  const TERRAIN = { amp: 0, flats: [] };
${MATERIAL_CACHE}
${helperBlock(needs)}
${indent(factory.source)}
  return ${factory.fnName}(THREE, M, { ...${lit({ ...modelDefaults(model), ...params })}, ...params }, ${matExpr(material)});
}
`;
}

export class CodegenAgent extends Agent {
  constructor() {
    super({
      name: 'codegen',
      role: 'Emits clean, modern (r187) three.js code: a reusable module and a runnable page.',
      subagents: [
        new SubAgent({
          name: 'module-emitter',
          description: 'scene.js — renderer-agnostic createScene(THREE) with only the helpers/factories used.',
          run: (bundle) => emitModule(bundle),
          test: () => assert(lit({ color: 0xff0000, roughness: 0.5, flag: true }) === '{ color: 0xff0000, roughness: 0.5, flag: true }', 'literal'),
        }),
        new SubAgent({
          name: 'html-emitter',
          description: 'index.html — importmap CDN, tone mapping, sRGB, PMREM env, OrbitControls, Timer, resize.',
          run: (input) => emitHtml(input),
          test: () => {
            const h = emitHtml({ title: 'a<b', moduleSource: 'export function createScene(THREE){}' });
            assert(h.includes('a&lt;b') && h.includes('function createScene') && !h.includes('export function') && h.includes('setAnimationLoop'), 'html');
          },
        }),
        new SubAgent({
          name: 'model-emitter',
          description: 'model.js — a single model as createModel(THREE, params).',
          run: (input) => emitModel(input),
          test: () => {
            const src = emitModel({ model: 'box', factory: { fnName: 'makeBox', source: MODELS.box.fn.toString(), needs: [] }, material: null, params: {} });
            assert(src.includes('export function createModel') && src.includes('makeBox'), 'model');
          },
        }),
      ],
    });
  }

  async handle(bundle, ctx) {
    const module = await this.delegate('module-emitter', bundle, ctx);
    const html = await this.delegate('html-emitter', { title: bundle.spec.title, moduleSource: module }, ctx);
    return { module, html };
  }
}
