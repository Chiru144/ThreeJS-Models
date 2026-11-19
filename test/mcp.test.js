// Starts the real server over stdio and talks to it like an MCP client would.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const server = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/server.js');
let client, dir;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'forge-mcp-'));
  client = new Client({ name: 'test', version: '1.0.0' });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [server], env: { ...process.env, THREEJS_FORGE_OUT: dir }, stderr: 'pipe' }));
});
after(async () => {
  await client?.close();
  await rm(dir, { recursive: true, force: true });
});

const call = async (name, args = {}) => {
  const r = await client.callTool({ name, arguments: args });
  return { ...r, text: r.content.map((c) => c.text).join('\n') };
};

test('lists the eight forge tools with compact descriptions', async () => {
  const { tools } = await client.listTools();
  assert.deepEqual(tools.map((t) => t.name).sort(), ['forge_build', 'forge_catalog', 'forge_character', 'forge_health', 'forge_model', 'forge_plan', 'forge_review', 'forge_sculpt']);
  const size = JSON.stringify(tools).length;
  assert.ok(size < 9000, `tool definitions are ${size} chars; keep them lean (they sit in every prompt)`);
});

test('forge_health: all agents and sub-agents healthy', async () => {
  const r = await call('forge_health');
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /16\/16 agents · (\d+)\/\1 sub-agents/);
});

test('forge_build writes files and returns a short summary (no code by default)', async () => {
  const r = await call('forge_build', { prompt: 'a red car next to 10 pine trees', out_dir: 'cars' });
  assert.ok(!r.isError, r.text);
  assert.ok(!r.text.includes('```'), 'code should not be inlined by default');
  assert.ok(r.text.length < 1200, `summary is ${r.text.length} chars`);
  await access(path.join(dir, 'cars', 'index.html'));
});

test('forge_build return_code inlines scene.js', async () => {
  const r = await call('forge_build', { prompt: 'a spinning gold torus knot', write_files: false, return_code: true });
  assert.ok(r.text.includes('export function createScene'));
});

test('forge_plan returns a JSON spec forge_build accepts', async () => {
  const r = await call('forge_plan', { prompt: '3 floating crystals in a cave' });
  const spec = JSON.parse(r.text.split('\nwarnings:')[0]);
  assert.ok(spec.objects.some((o) => o.model === 'crystal'));
  const b = await call('forge_build', { spec, write_files: false });
  assert.ok(!b.isError, b.text);
});

test('forge_model, forge_review, forge_catalog', async () => {
  const m = await call('forge_model', { model: 'house', params: { lit: true } });
  assert.ok(m.text.includes('createModel'));
  const rv = await call('forge_review', { code: 'new THREE.Geometry();' });
  assert.match(rv.text, /removed-geometry/);
  const c = await call('forge_catalog', { section: 'lighting' });
  assert.ok(JSON.parse(c.text).lighting.includes('sunset'));
});

test('forge_character designs a person and writes a rigged model + preview', async () => {
  const r = await call('forge_character', { description: 'an old wizard with a long white beard waving', out_dir: 'wizard' });
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /sheet: wizard, elder male/);
  await access(path.join(dir, 'wizard', 'model.js'));
  await access(path.join(dir, 'wizard', 'index.html'));
});

test('forge_sculpt builds a custom model and reports craft + quality', async () => {
  const cat = await call('forge_catalog', { section: 'blueprint' });
  const { example } = JSON.parse(cat.text).blueprint;
  const r = await call('forge_sculpt', { blueprint: example, out_dir: 'mug' });
  assert.ok(!r.isError, r.text);
  assert.match(r.text, /craft \d+\/100 · quality \d+\/100/);
  assert.ok(r.text.length < 1200, `reply is ${r.text.length} chars`);
  await access(path.join(dir, 'mug', 'model.glb'));
  const bad = await call('forge_sculpt', { blueprint: { parts: [{ name: 'a', shapes: [{ type: 'blob' }] }] } });
  assert.ok(bad.isError && /type must be one of/.test(bad.text));
});

test('bad input returns an MCP error result, not a crash', async () => {
  const r = await call('forge_model', { model: 'flibbertigibbet' });
  assert.equal(r.isError, true);
  const again = await call('forge_catalog', { section: 'materials' });
  assert.ok(!again.isError);
});
