#!/usr/bin/env node
// Environment doctor: verifies that every agent and sub-agent works on THIS machine,
// the full pipeline runs, files can be written, and the MCP server answers over stdio.
//   npm run doctor            human-readable report
//   npm run doctor -- --json  machine-readable
//   npm run doctor -- --browser  also render a scene in headless Chromium (needs playwright)
import { createRequire } from 'node:module';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const asJson = args.has('--json');
const results = [];
const tty = process.stdout.isTTY && !asJson;
const c = (code, s) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);
const ok = (s) => c(32, s), bad = (s) => c(31, s), dim = (s) => c(2, s), bold = (s) => c(1, s);

/** Walk up from a resolved entry file to the package.json that names `dep`. */
async function findPkg(file, dep) {
  let dir = path.dirname(file);
  while (dir !== path.dirname(dir)) {
    try {
      const pkg = JSON.parse(await readFile(path.join(dir, 'package.json'), 'utf8'));
      if (pkg.name === dep) return pkg;
    } catch { /* keep walking */ }
    dir = path.dirname(dir);
  }
  throw new Error('package.json not found');
}

function record(group, name, pass, info = '') {
  results.push({ group, name, ok: pass, info });
  if (!asJson) console.log(`  ${pass ? ok('✔') : bad('✘')} ${name}${info ? dim(`  ${info}`) : ''}`);
}
const section = (t) => !asJson && console.log(`\n${bold(t)}`);

async function main() {
  if (!asJson) console.log(bold('threejs-forge doctor'));

  section('Environment');
  const [maj, min] = process.versions.node.split('.').map(Number);
  record('env', `Node.js ${process.version}`, maj > 18 || (maj === 18 && min >= 17), 'needs >= 18.17');
  const require = createRequire(path.join(ROOT, 'package.json'));
  for (const [dep, entry] of [['@modelcontextprotocol/sdk', '@modelcontextprotocol/sdk/server/mcp.js'], ['three', 'three'], ['zod', 'zod'], ['acorn', 'acorn']]) {
    try {
      const v = (await findPkg(require.resolve(entry), dep)).version;
      record('env', `${dep}@${v}`, true);
    } catch (e) {
      record('env', dep, false, 'not installed — run npm install');
    }
  }
  if (results.some((r) => !r.ok)) return finish();

  const { Orchestrator } = await import('../src/core/orchestrator.js');
  const work = await mkdtemp(path.join(tmpdir(), 'threejs-forge-'));
  const orch = new Orchestrator({ baseDir: work });

  section('Agents and sub-agents');
  const health = await orch.health({ e2e: false });
  for (const a of health.agents) {
    record('agents', `${a.agent}`, a.ok, a.ok ? `${a.subagents.length} sub-agents` : '');
    for (const s of a.subagents) record('subagents', `  ${a.agent}/${s.name}`, s.ok, s.ok ? `${s.ms} ms` : s.error);
  }

  section('Pipeline');
  const prompts = [
    'a village at sunset with a red car and 2 rotating gold robots',
    'saturn with 60 asteroids orbiting in space',
    'studio shot of a glass vase and a chrome sphere',
    'a forest on hills with a cabin and a lake at night',
  ];
  for (const p of prompts) {
    try {
      const r = await orch.build({ prompt: p, out_dir: 'doctor' });
      const s = r.validation.runtime?.stats;
      record('pipeline', `build: "${p}"`, r.ok, r.ok ? `${r.ms} ms · ${s.drawCalls} draws · ${s.triangles} tris` : JSON.stringify(r.validation).slice(0, 200));
    } catch (e) { record('pipeline', `build: "${p}"`, false, e.message); }
  }
  try {
    const files = await Promise.all(['index.html', 'scene.js', 'spec.json'].map((f) => readFile(path.join(work, 'doctor', f), 'utf8')));
    record('pipeline', 'files written to disk', files.every((f) => f.length > 100), path.join(work, 'doctor'));
  } catch (e) { record('pipeline', 'files written to disk', false, e.message); }
  try {
    const m = await orch.model({ model: 'tree', params: { style: 'round' } });
    record('pipeline', 'single model (tree)', m.ok);
    const rv = await orch.review({ code: 'const r = new THREE.WebGLRenderer(); r.outputEncoding = THREE.sRGBEncoding;' });
    record('pipeline', 'code review', rv.findings.some((f) => f.id === 'encoding-api'), `score ${rv.score}`);
  } catch (e) { record('pipeline', 'model/review', false, e.message); }

  section('MCP protocol (stdio)');
  try {
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
    const transport = new StdioClientTransport({
      command: process.execPath, args: [path.join(ROOT, 'src/server.js')],
      env: { ...process.env, THREEJS_FORGE_OUT: work }, stderr: 'pipe',
    });
    const client = new Client({ name: 'doctor', version: '1.0.0' });
    await client.connect(transport);
    const { tools } = await client.listTools();
    record('mcp', 'server starts and lists tools', tools.length === 6, tools.map((t) => t.name).join(', '));
    const h = await client.callTool({ name: 'forge_health', arguments: {} });
    record('mcp', 'forge_health over MCP', !h.isError, h.content[0].text.split('\n')[0]);
    const b = await client.callTool({ name: 'forge_build', arguments: { prompt: 'a spinning gold torus knot', write_files: false } });
    record('mcp', 'forge_build over MCP', !b.isError, `${b.content[0].text.length} chars reply`);
    await client.close();
  } catch (e) { record('mcp', 'MCP stdio round-trip', false, e.message); }

  if (args.has('--browser')) {
    section('Browser render (headless Chromium)');
    try {
      let pw;
      try { pw = await import('playwright'); } catch { pw = require('playwright'); }
      const { chromium } = pw;
      const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      let threeDir = path.dirname(require.resolve('three'));
      while (!threeDir.endsWith(`${path.sep}three`)) threeDir = path.dirname(threeDir);
      await page.route(/cdn\.jsdelivr\.net\/npm\/three@[^/]+\/(.*)/, (route) => route.fulfill({
        path: path.join(threeDir, route.request().url().replace(/.*three@[^/]+\//, '')), contentType: 'text/javascript',
      }));
      await page.goto(`file://${path.join(work, 'doctor', 'index.html')}`);
      await page.waitForTimeout(1500);
      const drawn = await page.evaluate(() => !!document.querySelector('canvas'));
      record('browser', 'index.html renders without errors', drawn && errors.length === 0, errors.join(' | '));
      await browser.close();
    } catch (e) { record('browser', 'browser render', false, `${e.message.split('\n')[0]} (install playwright to use --browser)`); }
  }

  await rm(work, { recursive: true, force: true });
  return finish();
}

function finish() {
  const failed = results.filter((r) => !r.ok);
  if (asJson) console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  else console.log(`\n${failed.length ? bad(`✘ ${failed.length} check(s) failed`) : ok(`✔ all ${results.length} checks passed — threejs-forge is ready`)}`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
