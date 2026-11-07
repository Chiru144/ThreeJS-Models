// The orchestrator owns every agent, routes each task type through a pipeline
// of agents, caches plans, and writes files. Agents never talk to the client.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { TaskContext } from './agent.js';
import { PlannerAgent } from '../agents/planner.js';
import { ModelerAgent } from '../agents/modeler.js';
import { MaterialAgent } from '../agents/material.js';
import { OptimizerAgent } from '../agents/optimizer.js';
import { ComposerAgent } from '../agents/composer.js';
import { AnimationAgent } from '../agents/animation.js';
import { LightingAgent } from '../agents/lighting.js';
import { CodegenAgent } from '../agents/codegen.js';
import { ValidatorAgent } from '../agents/validator.js';
import { ReviewerAgent } from '../agents/reviewer.js';
import { MODELS, MODEL_ALIASES, sanitizeParams } from '../library/models.js';
import { MATERIAL_PRESETS, COLORS, resolveColor } from '../library/materials.js';
import { LIGHTING, ANIMATIONS, QUALITY } from '../library/presets.js';

const kb = (s) => `${(Buffer.byteLength(s) / 1024).toFixed(1)} KB`;
const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export class Orchestrator {
  constructor({ baseDir = process.env.THREEJS_FORGE_OUT || process.cwd(), allowAnyPath = process.env.THREEJS_FORGE_ALLOW_ANY_PATH === '1' } = {}) {
    this.baseDir = path.resolve(baseDir);
    this.allowAnyPath = allowAnyPath;
    this.agents = {
      planner: new PlannerAgent(),
      material: new MaterialAgent(),
      optimizer: new OptimizerAgent(),
      composer: new ComposerAgent(),
      modeler: new ModelerAgent(),
      animation: new AnimationAgent(),
      lighting: new LightingAgent(),
      codegen: new CodegenAgent(),
      validator: new ValidatorAgent(),
      reviewer: new ReviewerAgent(),
    };
    this.planCache = new Map();
    this.stats = { tasks: 0, byType: {} };
  }

  /** Single entry point: every tool call becomes a routed task. */
  async run(type, input = {}) {
    const routes = {
      plan: () => this.plan(input),
      build: () => this.build(input),
      model: () => this.model(input),
      review: () => this.review(input),
      catalog: () => this.catalog(input.section),
      health: () => this.health(input),
    };
    if (!routes[type]) throw new Error(`Unknown task type "${type}". Known: ${Object.keys(routes).join(', ')}`);
    this.stats.tasks++;
    this.stats.byType[type] = (this.stats.byType[type] || 0) + 1;
    return routes[type]();
  }

  resolveOut(dir) {
    const abs = path.resolve(this.baseDir, dir);
    if (!this.allowAnyPath && abs !== this.baseDir && !abs.startsWith(this.baseDir + path.sep)) {
      throw new Error(`out_dir must be inside ${this.baseDir} (set THREEJS_FORGE_ALLOW_ANY_PATH=1 to lift this).`);
    }
    return abs;
  }

  async plan({ prompt, spec, quality }, ctx = new TaskContext({ type: 'plan' })) {
    const key = spec ? null : `${prompt}|${quality || ''}`;
    if (key && this.planCache.has(key)) return { spec: structuredClone(this.planCache.get(key)), ctx, cached: true };
    if (!prompt && !spec) throw new Error('Provide "prompt" or "spec".');
    const out = await this.agents.planner.handle({ prompt, spec: spec && { ...spec, quality: quality || spec.quality } }, ctx);
    if (quality && QUALITY[quality]) {
      out.quality = quality;
      out.lighting.shadows = spec?.lighting?.shadows ?? QUALITY[quality].shadows;
    }
    if (key) {
      if (this.planCache.size > 64) this.planCache.delete(this.planCache.keys().next().value);
      this.planCache.set(key, structuredClone(out));
    }
    return { spec: out, ctx, cached: false };
  }

  async build({ prompt, spec: rawSpec, quality, out_dir, write_files = true, return_code = false, detail = 'brief' }) {
    const ctx = new TaskContext({ type: 'build' });
    const t0 = performance.now();
    const { spec, cached } = await this.plan({ prompt, spec: rawSpec, quality }, ctx);
    const A = this.agents;

    const materials = await A.material.handle(spec, ctx);
    await A.optimizer.handle(spec, ctx);
    const compose = await A.composer.handle(spec, ctx);
    const models = spec.objects.map((o) => o.model).concat(compose.env.autoGround ? ['ground'] : []);
    const factories = await A.modeler.handle(models, ctx);
    const animation = await A.animation.handle(spec, ctx);
    const lighting = await A.lighting.handle({ spec, extent: compose.layout.extent }, ctx);
    const { module, html } = await A.codegen.handle({ spec, factories, materials, compose, lighting, animation }, ctx);
    const files = { 'scene.js': module, 'index.html': html };
    const validation = await A.validator.handle({ files, quality: spec.quality }, ctx);
    if (validation.budget && !validation.budget.ok) validation.budget.issues.forEach((i) => ctx.warn(`budget: ${i}`));

    let written = null;
    if (write_files) {
      const dir = this.resolveOut(out_dir || path.join('threejs-output', spec.slug));
      await mkdir(dir, { recursive: true });
      await Promise.all(Object.entries(files).map(([n, s]) => writeFile(path.join(dir, n), s)));
      await writeFile(path.join(dir, 'spec.json'), JSON.stringify(stripSpec(spec), null, 2));
      written = dir;
    }
    return {
      ok: validation.ok, spec, files, written, validation, ctx, cached,
      ms: Math.round(performance.now() - t0),
      text: () => formatBuild({ spec, files, written, validation, ctx, detail, return_code: return_code || !write_files, baseDir: this.baseDir, ms: Math.round(performance.now() - t0) }),
    };
  }

  async model({ model, params = {}, preset, color, out_file }) {
    const ctx = new TaskContext({ type: 'model' });
    const alias = MODEL_ALIASES.get(String(model).toLowerCase());
    if (!alias) throw new Error(`Unknown model "${model}". Available: ${Object.keys(MODELS).join(', ')}`);
    const name = alias.model;
    const clean = sanitizeParams(name, { ...alias.params, ...params });
    const [factory] = await this.agents.modeler.handle([name], ctx);
    const mat0 = await this.agents.material.delegate('preset-mapper', { model: name, preset, color: resolveColor(color) }, ctx);
    const material = await this.agents.material.delegate('material-dedup', mat0, ctx);
    const source = await this.agents.codegen.delegate('model-emitter', { model: name, factory, material, params: clean }, ctx);
    const validation = await this.agents.validator.handle({ files: { 'model.js': source }, quality: 'high', entry: 'createModel', moduleName: 'model.js' }, ctx);
    let written = null;
    if (out_file) {
      written = this.resolveOut(out_file);
      await mkdir(path.dirname(written), { recursive: true });
      await writeFile(written, source);
    }
    return { ok: validation.ok, source, validation, written, ctx };
  }

  async review({ code, file }) {
    const ctx = new TaskContext({ type: 'review' });
    let src = code;
    if (!src && file) src = await readFile(this.resolveOut(file), 'utf8');
    if (!src) throw new Error('Provide "code" or "file".');
    return { ...(await this.agents.reviewer.handle({ code: src }, ctx)), ctx };
  }

  catalog(section = 'all') {
    const out = {};
    if (section === 'all' || section === 'models') {
      out.models = Object.fromEntries(Object.entries(MODELS).map(([n, m]) => [n, {
        kind: m.kind, aliases: m.aliases, params: Object.fromEntries(Object.entries(m.params).map(([p, v]) => [p, v.enum ? v.enum.join('|') : v.default])),
      }]));
    }
    if (section === 'all' || section === 'materials') out.materials = Object.keys(MATERIAL_PRESETS);
    if (section === 'all' || section === 'colors') out.colors = Object.keys(COLORS);
    if (section === 'all' || section === 'lighting') out.lighting = Object.keys(LIGHTING);
    if (section === 'all' || section === 'animations') out.animations = Object.fromEntries(Object.entries(ANIMATIONS).map(([n, a]) => [n, { speed: a.speed, amp: a.amp }]));
    if (section === 'all' || section === 'quality') out.quality = QUALITY;
    if (section === 'all' || section === 'agents') out.agents = Object.values(this.agents).map((a) => a.describe());
    if (section === 'all' || section === 'spec') out.specExample = SPEC_EXAMPLE;
    return out;
  }

  /** Self-test of every agent + sub-agent, then an end-to-end smoke build in memory. */
  async health({ e2e = true } = {}) {
    const t0 = performance.now();
    const agents = [];
    for (const a of Object.values(this.agents)) agents.push(await a.selfTest());
    let pipeline = null;
    if (e2e) {
      try {
        const r = await this.build({ prompt: 'a red car, 12 pine trees, 3 floating gold crystals at sunset', write_files: false });
        pipeline = { ok: r.ok, ms: r.ms, stats: r.validation.runtime?.stats, error: r.ok ? undefined : JSON.stringify(r.validation).slice(0, 400) };
      } catch (e) {
        pipeline = { ok: false, error: e.message };
      }
    }
    const subTotal = agents.reduce((s, a) => s + a.subagents.length, 0);
    const subOk = agents.reduce((s, a) => s + a.subagents.filter((x) => x.ok).length, 0);
    return {
      ok: agents.every((a) => a.ok) && (!pipeline || pipeline.ok),
      agents, pipeline, summary: { agents: agents.length, agentsOk: agents.filter((a) => a.ok).length, subagents: subTotal, subagentsOk: subOk },
      env: { node: process.version, platform: `${process.platform}-${process.arch}` },
      ms: Math.round(performance.now() - t0),
    };
  }
}

const SPEC_EXAMPLE = {
  title: 'Night market', quality: 'medium', seed: 42,
  lighting: { preset: 'night', shadows: true },
  environment: { ground: 'stone', fog: true },
  objects: [
    { model: 'robot', color: 'cyan', preset: 'metal', animation: { type: 'float', speed: 1.2 } },
    { model: 'house', count: 5, params: { lit: true } },
    { model: 'lamp', count: 4 },
    { model: 'tree', count: 20, params: { style: 'round' }, scale: 1.2 },
    { model: 'sphere', position: [3, 2, 0], preset: 'glass' },
  ],
};

/** Minimal, re-buildable spec: drops defaults/nulls so it is cheap to read and edit. */
export function compactSpec(spec) {
  const hexStr = (n) => `#${n.toString(16).padStart(6, '0')}`;
  return {
    title: spec.title, quality: spec.quality, seed: spec.seed,
    lighting: spec.lighting,
    environment: Object.fromEntries(Object.entries(spec.environment).filter(([, v]) => v !== undefined)),
    objects: spec.objects.map((o) => {
      const x = { model: o.model };
      if (o.count > 1) x.count = o.count;
      if (Object.keys(o.params).length) x.params = o.params;
      if (o.material.color !== undefined) x.color = hexStr(o.material.color);
      if (o.material.preset) x.preset = o.material.preset;
      if (o.animation) x.animation = o.animation;
      if (o.scale !== 1) x.scale = o.scale;
      if (o.position) x.position = o.position;
      if (o.rotationY) x.rotationY = o.rotationY;
      return x;
    }),
  };
}
const stripSpec = compactSpec;

function formatBuild({ spec, files, written, validation, ctx, detail, return_code, baseDir, ms }) {
  const v = validation;
  const s = v.runtime?.stats;
  const lines = [];
  lines.push(`${v.ok ? '✔' : '✘'} ${spec.title} (${spec.quality}, ${spec.lighting.preset}, ${ms} ms)`);
  if (written) lines.push(`files: ${path.relative(baseDir, written) || '.'}/ → ${Object.entries(files).map(([n, c]) => `${n} ${kb(c)}`).join(', ')}, spec.json`);
  lines.push(`objects: ${spec.objects.map((o) => `${o.model}×${o.count}${o.instanced ? '·inst' : ''}${o.animation ? `·${o.animation.type}` : ''}`).join(', ')}`);
  if (s) lines.push(`stats: ${s.drawCalls} draw calls · ${k(s.triangles)} tris · ${s.instances} instances · ${s.materials} materials · ${s.lights} lights · shadows ${spec.lighting.shadows ? 'on' : 'off'}`);
  lines.push(`checks: syntax ${v.syntax.ok ? '✔' : `✘ ${v.syntax.errors.join('; ')}`} · runtime ${v.runtime ? (v.runtime.ok ? '✔' : `✘ ${v.runtime.error}`) : '–'} · budget ${v.budget ? (v.budget.ok ? '✔' : '⚠') : '–'} · lint ${v.lint.length ? v.lint.map((x) => x.id).join(',') : '✔'}`);
  if (ctx.warnings.length) lines.push(`warnings: ${ctx.warnings.join(' | ')}`);
  if (detail === 'full') {
    if (ctx.notes.length) lines.push(`notes: ${ctx.notes.join(' | ')}`);
    const agg = new Map();
    for (const t of ctx.trace) {
      const key = `${t.agent}/${t.sub}`;
      const a = agg.get(key) || { n: 0, ms: 0 };
      a.n++; a.ms += t.ms;
      agg.set(key, a);
    }
    lines.push(`trace: ${[...agg].map(([n, a]) => `${n}${a.n > 1 ? `×${a.n}` : ''} ${a.ms.toFixed(1)}ms`).join(' → ')}`);
    lines.push(`spec: ${JSON.stringify(stripSpec(spec))}`);
  }
  if (return_code) lines.push('', '```js', files['scene.js'].trimEnd(), '```');
  else if (written) lines.push('Open index.html in a browser. Import scene.js into any app: createScene(THREE).');
  return lines.join('\n');
}
