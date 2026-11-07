import { Agent, SubAgent, assert } from '../core/agent.js';
import { parse, lint, extractScripts } from '../library/rules.js';
import { THREE, measure } from '../core/sandbox.js';
import { QUALITY } from '../library/presets.js';

async function importSource(src) {
  return import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
}

function checkSyntax(files) {
  const errors = [];
  for (const [name, src] of Object.entries(files)) {
    const { error } = parse(name.endsWith('.html') ? extractScripts(src) : src);
    if (error) errors.push(`${name}:${error.line ?? '?'} ${error.message}`);
  }
  return { ok: errors.length === 0, errors };
}

/** Executes the generated module against real three.js and measures the result. */
async function runRuntime({ source, entry = 'createScene' }) {
  const mod = await importSource(source);
  assert(typeof mod[entry] === 'function', `module does not export ${entry}()`);
  if (entry === 'createModel') {
    const obj = mod.createModel(THREE);
    assert(obj?.isObject3D, 'createModel did not return an Object3D');
    const stats = measure(obj);
    assert(stats.finite, 'non-finite transforms');
    return { ok: true, stats };
  }
  const app = mod.createScene(THREE, { aspect: 1.5 });
  assert(app?.scene?.isScene, 'createScene did not return { scene }');
  assert(app.camera?.isPerspectiveCamera, 'missing PerspectiveCamera');
  for (let i = 1; i <= 3; i++) app.update(i / 60, 1 / 60);
  const stats = measure(app.scene);
  assert(stats.finite, 'scene has NaN/Infinity transforms after update()');
  assert(app.camera.position.toArray().every(Number.isFinite), 'camera position is not finite');
  assert(stats.meshes + stats.points > 0, 'scene is empty');
  app.dispose();
  return { ok: true, stats };
}

function checkBudget({ stats, quality }) {
  const q = QUALITY[quality] || QUALITY.medium;
  const issues = [];
  if (stats.triangles > q.triBudget) issues.push(`triangles ${stats.triangles} > ${q.triBudget}`);
  if (stats.drawCalls > q.drawBudget) issues.push(`draw calls ${stats.drawCalls} > ${q.drawBudget}`);
  if (stats.shadowLights > 2) issues.push(`${stats.shadowLights} shadow-casting lights`);
  if (stats.lights === 0) issues.push('no lights');
  return { ok: issues.length === 0, issues };
}

export class ValidatorAgent extends Agent {
  constructor() {
    super({
      name: 'validator',
      role: 'Proves the output works: parses it, runs it in real three.js, checks budgets and lint rules.',
      subagents: [
        new SubAgent({
          name: 'syntax-validator',
          description: 'Parses every emitted JS/HTML file with acorn (ES2024+, modules).',
          run: (files) => checkSyntax(files),
          test: () => assert(checkSyntax({ 'a.js': 'export const a = 1;' }).ok && !checkSyntax({ 'b.js': 'const = ;' }).ok),
        }),
        new SubAgent({
          name: 'runtime-validator',
          description: 'Imports the module, builds the scene with three.js, runs update() and dispose().',
          run: (input) => runRuntime(input),
          test: async () => {
            const src = 'export function createScene(THREE){const scene=new THREE.Scene();scene.add(new THREE.AmbientLight(),new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial()));return{scene,camera:new THREE.PerspectiveCamera(),update(){},dispose(){}}}';
            const r = await runRuntime({ source: src });
            assert(r.stats.triangles === 12 && r.stats.lights === 1, 'runtime stats');
          },
        }),
        new SubAgent({
          name: 'budget-checker',
          description: 'Compares measured triangles, draw calls and shadow lights with the quality budget.',
          run: (input) => checkBudget(input),
          test: () => assert(checkBudget({ stats: { triangles: 10, drawCalls: 1, shadowLights: 1, lights: 2 }, quality: 'low' }).ok),
        }),
        new SubAgent({
          name: 'best-practice-linter',
          description: 'Runs the shared three.js rule set over the generated page.',
          run: (src) => lint(src).findings.filter((x) => x.severity !== 'info'),
          test: () => assert(lint('renderer.outputEncoding = THREE.sRGBEncoding;').findings.some((x) => x.id === 'encoding-api')),
        }),
      ],
    });
  }

  async handle({ files, quality, entry = 'createScene', moduleName = 'scene.js' }, ctx) {
    const syntax = await this.delegate('syntax-validator', files, ctx);
    if (!syntax.ok) return { ok: false, syntax, runtime: null, budget: null, lint: [] };
    let runtime;
    try {
      runtime = await this.delegate('runtime-validator', { source: files[moduleName], entry }, ctx);
    } catch (e) {
      runtime = { ok: false, error: e.message };
    }
    const budget = runtime.ok ? await this.delegate('budget-checker', { stats: runtime.stats, quality }, ctx) : null;
    const html = Object.entries(files).find(([n]) => n.endsWith('.html'));
    const findings = html ? await this.delegate('best-practice-linter', html[1], ctx) : [];
    return { ok: syntax.ok && runtime.ok && !findings.some((x) => x.severity === 'error'), syntax, runtime, budget, lint: findings };
  }
}
