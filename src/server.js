#!/usr/bin/env node
// threejs-forge-mcp: MCP stdio server. Every tool call is routed to the
// Orchestrator, which delegates to agents and their sub-agents.
// Agents are deterministic code (no extra LLM calls), so the only tokens spent
// are the tool call and its compact reply. Files go to disk; code is returned
// only when asked.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Orchestrator, compactSpec } from './core/orchestrator.js';

const pkg = { name: 'threejs-forge', version: '1.0.0' };

const objectSchema = z.object({
  model: z.string().describe('Model name or alias, see forge_catalog'),
  count: z.number().int().min(1).max(5000).optional(),
  params: z.record(z.string(), z.any()).optional(),
  color: z.union([z.string(), z.number()]).optional().describe('name, #hex or 0xhex'),
  preset: z.string().optional().describe('material preset'),
  animation: z.union([z.string(), z.object({ type: z.string(), speed: z.number().optional(), amp: z.number().nullish() })]).nullish(),
  scale: z.number().optional(),
  position: z.array(z.number()).length(3).nullish(),
  rotationY: z.number().optional(),
  id: z.string().optional(),
}).loose();

const specSchema = z.object({
  title: z.string().optional(),
  quality: z.enum(['low', 'medium', 'high']).optional(),
  style: z.enum(['realistic', 'stylized']).optional().describe('realistic (sculpted, default) or stylized (low-poly)'),
  seed: z.number().int().optional(),
  lighting: z.union([z.string(), z.object({ preset: z.string(), shadows: z.boolean().optional() })]).optional(),
  environment: z.object({ ground: z.string().optional(), fog: z.boolean().optional(), background: z.union([z.string(), z.number()]).optional() }).optional(),
  objects: z.array(objectSchema).min(1),
}).loose();

const text = (t) => ({ content: [{ type: 'text', text: t }] });
const fail = (e) => ({ content: [{ type: 'text', text: `✘ ${e.message}` }], isError: true });
const json = (o) => JSON.stringify(o);

export function createServer(orchestrator = new Orchestrator()) {
  const server = new McpServer(pkg, {
    instructions: 'Three.js scene/model generator. Typical flow: forge_build with a prompt (or a spec from forge_plan/forge_catalog). Output is written to disk and summarized; pass return_code only if you need the code inline. Use forge_review on existing three.js code and forge_health if anything fails.',
  });
  const o = orchestrator;

  server.registerTool('forge_build', {
    title: 'Build Three.js scene',
    description: 'Prompt or spec → validated three.js scene (index.html + reusable scene.js). People and animals are planned by the character/creature agents, then material→optimizer→composer→modeler→animation→lighting→codegen→validator. Returns a short summary.',
    inputSchema: {
      prompt: z.string().optional().describe('e.g. "a village at sunset with 3 red cars and floating crystals"'),
      spec: specSchema.optional().describe('Exact spec (overrides prompt). See forge_catalog section=spec'),
      quality: z.enum(['low', 'medium', 'high']).optional(),
      out_dir: z.string().optional().describe('Relative to server base dir. Default threejs-output/<slug>'),
      write_files: z.boolean().optional().describe('Default true'),
      return_code: z.boolean().optional().describe('Include scene.js in reply (costs tokens). Default false'),
      detail: z.enum(['brief', 'full']).optional().describe('full adds agent trace + resolved spec'),
    },
  }, async (args) => {
    try {
      const r = await o.run('build', args);
      return { ...text(r.text()), isError: !r.ok };
    } catch (e) { return fail(e); }
  });

  server.registerTool('forge_plan', {
    title: 'Plan scene spec',
    description: 'Prompt → resolved JSON spec only (no code). Cheap: edit the spec, then pass it to forge_build.',
    inputSchema: { prompt: z.string(), quality: z.enum(['low', 'medium', 'high']).optional() },
  }, async (args) => {
    try {
      const { spec, ctx } = await o.run('plan', args);
      return text(json(compactSpec(spec)) + (ctx.warnings.length ? `\nwarnings: ${ctx.warnings.join(' | ')}` : ''));
    } catch (e) { return fail(e); }
  });

  server.registerTool('forge_model', {
    title: 'Generate one model',
    description: 'Single procedural model as a reusable ES module createModel(THREE, params), validated in real three.js.',
    inputSchema: {
      model: z.string().describe('tree, rock, house, car, robot, planet, vase, crystal, ... (forge_catalog)'),
      params: z.record(z.string(), z.any()).optional(),
      preset: z.string().optional(),
      color: z.union([z.string(), z.number()]).optional(),
      out_file: z.string().optional().describe('Write here instead of returning code'),
      style: z.enum(['realistic', 'stylized']).optional(),
    },
  }, async (args) => {
    try {
      const r = await o.run('model', args);
      const s = r.validation.runtime?.stats;
      const head = `${r.ok ? '✔' : '✘'} ${args.model}: ${s ? `${s.triangles} tris · ${s.drawCalls} draw calls · ${s.materials} materials` : r.validation.runtime?.error}`;
      return { ...text(r.written ? `${head}\nwritten: ${r.written}` : `${head}\n\`\`\`js\n${r.source.trimEnd()}\n\`\`\``), isError: !r.ok };
    } catch (e) { return fail(e); }
  });

  server.registerTool('forge_character', {
    title: 'Design a character or creature',
    description: 'Describe one person, animal or creature → character/creature agents plan anatomy, appearance, wardrobe or coat, and gait. Writes model.js (rigged createModel) + a studio preview. Returns the design sheet.',
    inputSchema: {
      description: z.string().describe('e.g. "an old wizard with a long white beard waving", "a black and white horse galloping", "a red dragon flying"'),
      out_dir: z.string().optional(),
      write_files: z.boolean().optional(),
    },
  }, async (args) => {
    try {
      const r = await o.run('character', args);
      const s = r.build.validation.runtime?.stats;
      const lines = [
        `${r.ok ? '✔' : '✘'} ${r.subject.model}${r.others ? ` (+${r.others} other object(s) in the description ignored)` : ''}`,
        `sheet: ${r.sheet}`,
        r.build.written ? `files: ${r.build.written} → index.html (preview), scene.js, model.js` : '',
        s ? `stats: ${s.drawCalls} draw calls · ${s.triangles} tris · rig modes checked` : '',
        `params: ${json(r.subject.params)}`,
      ];
      return { ...text(lines.filter(Boolean).join('\n')), isError: !r.ok };
    } catch (e) { return fail(e); }
  });

  server.registerTool('forge_review', {
    title: 'Review three.js code',
    description: 'Static review of existing three.js code/HTML: removed APIs, per-frame allocations, shadows, colour space, resize, pixel ratio. Returns score + fixes.',
    inputSchema: {
      code: z.string().optional(),
      file: z.string().optional().describe('Path relative to server base dir'),
    },
  }, async (args) => {
    try {
      const r = await o.run('review', args);
      const lines = [`score ${r.score}/100 · ${r.findings.length} finding(s)`];
      for (const f of r.findings) lines.push(`[${f.severity}] ${f.id}${f.line ? ` (line ${f.line})` : ''}: ${f.message} → ${f.fix}`);
      return text(lines.join('\n'));
    } catch (e) { return fail(e); }
  });

  server.registerTool('forge_catalog', {
    title: 'Catalog',
    description: 'Lists models+params, materials, colours, lighting, animations, quality budgets, agents, or a spec example. Ask for one section to save tokens.',
    inputSchema: { section: z.enum(['models', 'characters', 'creatures', 'materials', 'colors', 'lighting', 'animations', 'quality', 'agents', 'spec', 'all']).optional() },
  }, async ({ section = 'models' }) => text(json(await o.run('catalog', { section }))));

  server.registerTool('forge_health', {
    title: 'Health check',
    description: 'Self-tests every agent and sub-agent in this environment, plus an end-to-end build.',
    inputSchema: {},
  }, async () => {
    const r = await o.run('health', {});
    const lines = [`${r.ok ? '✔ healthy' : '✘ problems found'} · ${r.summary.agentsOk}/${r.summary.agents} agents · ${r.summary.subagentsOk}/${r.summary.subagents} sub-agents · ${r.env.node} ${r.env.platform} · ${r.ms} ms`];
    for (const a of r.agents) {
      const bad = a.subagents.filter((s) => !s.ok);
      lines.push(`${a.ok ? '✔' : '✘'} ${a.agent}: ${a.subagents.map((s) => s.name).join(', ')}${bad.length ? ` — FAILED ${bad.map((b) => `${b.name}: ${b.error}`).join('; ')}` : ''}`);
    }
    if (r.pipeline) lines.push(`${r.pipeline.ok ? '✔' : '✘'} pipeline e2e${r.pipeline.ok ? ` ${r.pipeline.ms} ms, ${r.pipeline.stats.drawCalls} draw calls` : `: ${r.pipeline.error}`}`);
    return { ...text(lines.join('\n')), isError: !r.ok };
  });

  return server;
}

const isMain = (() => {
  try { return realpathSync(process.argv[1]) === fileURLToPath(import.meta.url); } catch { return false; }
})();
if (isMain) {
  const server = createServer();
  await server.connect(new StdioServerTransport());
  console.error('[threejs-forge] MCP server ready on stdio');
}
