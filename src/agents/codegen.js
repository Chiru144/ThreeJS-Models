import { Agent, SubAgent, assert } from '../core/agent.js';
import * as H from '../library/helpers.js';
import { MODELS, modelDefaults } from '../library/models.js';
import { THREE_VERSION, QUALITY } from '../library/presets.js';

const HEX_KEYS = new Set(['color', 'emissive', 'specularColor', 'sheenColor', 'attenuationColor']);
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
  const order = ['rng', 'heightAt', 'scatter', 'instanceize'];
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
  push(`  scene.add(new THREE.HemisphereLight(${hex(sky)}, ${hex(gnd)}, ${num(hi)}));`);
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
    push(`  scene.add(makeGround(THREE, M, { size: ${env.groundSize} }, ${matExpr(materials.ground)}));`);
  }

  const anyAnim = animation.bindings.length > 0;
  if (anyAnim) {
    push('');
    push('  const anims = [];');
    push('  const animate = (o, type, speed, amp, phase) => anims.push({ o, type, speed, amp, phase, y: o.position.y, s: o.scale.x, r: Math.hypot(o.position.x, o.position.z) || 4, a: Math.atan2(o.position.z, o.position.x) });');
  }
  const scattered = layout.items.some((i) => i.mode === 'scatter');
  if (scattered) push(`  const occupied = ${lit(layout.occupied)};`);
  push('  const place = (child, x, y, z, ry, s) => { const g = new THREE.Group(); g.add(child); g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(s); return g; };');

  for (const o of spec.objects) {
    const item = byId[o.id];
    const fn = factories.find((f) => f.model === o.model).fnName;
    const params = lit({ ...modelDefaults(o.model), ...o.params });
    const mat = matExpr(materials.byId[o.id]);
    const a = animById[o.id];
    push('');
    push(`  // ${o.id} · ${o.model} ×${o.count}${o.instanced ? ' (instanced)' : ''}`);
    if (item.mode === 'backdrop' || item.mode === 'surface') {
      if (o.model === 'ground' && !env.autoGround) push(`  scene.add(${fn}(THREE, M, ${params}, ${mat}));`);
      else if (item.mode === 'backdrop') push(`  { const o = ${fn}(THREE, M, ${params}, ${mat}); o.name = '${o.id}'; scene.add(o);${a ? ` animate(o, '${a.type}', ${num(a.speed)}, ${num(a.amp ?? 0)}, 0);` : ''} }`);
      else push(`  { const o = ${fn}(THREE, M, ${params}, ${mat}); o.name = '${o.id}'; scene.add(o); }`);
      continue;
    }
    if (item.mode === 'row') {
      const [px, py, pz] = item.positions[0];
      const single = item.positions.length === 1;
      push(single ? '  {' : `  ${lit(item.positions)}.forEach(([px, py, pz], i) => {`);
      const X = single ? num(px) : 'px', Y = single ? num(py) : 'py', Z = single ? num(pz) : 'pz';
      const Yexpr = env.terrain.amp ? `heightAt(${X}, ${Z}) + ${Y}` : Y;
      push(`    const o = place(${fn}(THREE, M, ${params}, ${mat}), ${X}, ${Yexpr}, ${Z}, ${num(o.rotationY)}, ${num(o.scale)});`);
      push(single ? `    o.name = '${o.id}';` : `    o.name = '${o.id}_' + i;`);
      push('    scene.add(o);');
      if (a) push(`    animate(o, '${a.type}', ${num(a.speed)}, ${num(a.amp ?? 0)}, ${single ? 0 : 'i * 0.7'});`);
      push(single ? '  }' : '  });');
      continue;
    }
    const s = item.scatter;
    push('  {');
    push(`    const pts = scatter(${s.count}, ${s.inner}, ${s.outer}, ${s.minDist}, ${s.seed}, occupied, ${s.yJitter});`);
    if (o.instanced) {
      needs.add('instanceize');
      push(`    const g = instanceize(${fn}(THREE, M, ${params}, ${mat}), ${o.scale === 1 ? 'pts' : `pts.map(([x, y, z, ry, s]) => [x, y, z, ry, s * ${num(o.scale)}])`});`);
      push(`    g.name = '${o.id}';`);
      push('    scene.add(g);');
      if (a) push(`    animate(g, '${a.type}', ${num(a.speed)}, ${num(a.amp ?? 0)}, 0);`);
    } else {
      push('    pts.forEach(([x, y, z, ry, s], i) => {');
      push(`      const o = place(${fn}(THREE, M, ${params}, ${mat}), x, y, z, ry, s${o.scale === 1 ? '' : ` * ${num(o.scale)}`});`);
      push(`      o.name = '${o.id}_' + i;`);
      push('      scene.add(o);');
      if (a) push(`      animate(o, '${a.type}', ${num(a.speed)}, ${num(a.amp ?? 0)}, i * 0.7);`);
      push('    });');
    }
    push('  }');
  }
  if (scattered) needs.add('scatter').add('rng');
  if (lighting.enabled) {
    push('');
    push('  scene.traverse((o) => { if (o.isMesh) { o.castShadow = !o.userData.noCast && !o.userData.noShadow; o.receiveShadow = !o.userData.noShadow; } });');
  }

  const bg = spec.environment.background ?? lighting.rig.background;
  const fog = lighting.rig.fog != null && spec.environment.fog && !layout.space
    ? `\n  scene.fog = new THREE.Fog(${hex(lighting.rig.fog)}, ${num(Math.max(20, layout.extent * 1.5))}, ${num(Math.max(80, layout.extent * 5 + 40))});` : '';
  const usedFactories = factories.filter((f) => spec.objects.some((o) => o.model === f.model) || (f.model === 'ground' && env.autoGround));
  const q = QUALITY[spec.quality];
  const settings = {
    quality: spec.quality, shadows: lighting.enabled, exposure: lighting.rig.exposure, envMap: true, envIntensity: lighting.rig.envIntensity,
    pixelRatioCap: q.pixelRatioCap, antialias: q.antialias, target: camera.target, maxDistance: camera.maxDistance, maxPolar: camera.maxPolar,
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

  return { scene, camera, update, dispose, settings: ${lit(settings)} };
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
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

${inline}
const app = createScene(THREE, { aspect: innerWidth / innerHeight });
const { scene, camera, settings } = app;

const renderer = new THREE.WebGLRenderer({ antialias: settings.antialias, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, settings.pixelRatioCap));
renderer.setSize(innerWidth, innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = settings.exposure;
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFShadowMap;
document.body.appendChild(renderer.domElement);

if (settings.envMap) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = settings.envIntensity;
  pmrem.dispose();
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
});

const timer = new THREE.Timer();
timer.connect(document);
renderer.setAnimationLoop((time) => {
  timer.update(time);
  app.update(timer.getElapsed(), Math.min(timer.getDelta(), 0.1));
  controls.update();
  renderer.render(scene, camera);
});
</script>
</body>
</html>
`;
}

/** model.js: a single reusable model factory module. */
function emitModel({ model, factory, material, params }) {
  const needs = new Set(factory.needs);
  return `// ${model} — generated by threejs-forge-mcp for three.js r${THREE_VERSION.split('.')[1]}
// import * as THREE from 'three'; scene.add(createModel(THREE, { /* params */ }));
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
