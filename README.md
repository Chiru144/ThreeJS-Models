# ThreeJS Forge MCP

An MCP server that turns a sentence (or a JSON spec) into a **validated, modern three.js scene**: a self-contained `index.html` you can open, plus a reusable `scene.js` module you can drop into any app (Vite, React, Next, plain JS).

Inside, an **orchestrator** routes every request through **10 agents and 31 sub-agents**, each owning one job. Each one has a self-test, so you can check the whole tree on your own machine.

![Four generated scenes](docs/preview.png)

*Generated from: "A cozy village at sunset with a red car and two rotating golden robots" · "a dense forest on hills with a cabin and a lake at night" · "saturn with 80 asteroids orbiting in space" · "studio product shot of a rotating glass vase, a gold torus knot and a chrome sphere".*

## Quick start

```bash
git clone https://github.com/chiru144/threejs-models.git
cd threejs-models
npm install
npm run doctor        # checks every agent + sub-agent in YOUR environment
npm test              # full test suite (93 tests)
```

### Connect it to your MCP client

**Claude Code**: this repo ships an `.mcp.json`, so opening Claude Code in the folder offers the server automatically. To use it from anywhere:

```bash
claude mcp add threejs-forge -- node /absolute/path/to/threejs-models/src/server.js
```

**Claude Desktop / Cursor / other clients**: add to the client's MCP config:

```json
{
  "mcpServers": {
    "threejs-forge": {
      "command": "node",
      "args": ["/absolute/path/to/threejs-models/src/server.js"],
      "env": { "THREEJS_FORGE_OUT": "/absolute/path/where/scenes/should/go" }
    }
  }
}
```

Then just ask: *"Use threejs-forge to build a snowy village at night with glowing windows and 3 floating crystals."*

## Tools

| Tool | What it does | Typical reply size |
|---|---|---|
| `forge_build` | Prompt or spec → `index.html` + `scene.js` + `spec.json`, validated in real three.js | ~450 chars |
| `forge_plan` | Prompt → compact JSON spec (no code). Edit it, then pass it to `forge_build` | ~300 chars |
| `forge_model` | One model (`tree`, `car`, `robot`, `vase`…) as `createModel(THREE, params)` | code, or a path with `out_file` |
| `forge_review` | Reviews *your* three.js code: removed APIs, per-frame allocations, shadows, colour space, resize, pixel ratio. Score + fixes | one line per finding |
| `forge_catalog` | Models + params, materials, colours, lighting, animations, budgets, agents, spec example. Request one `section` at a time | 0.3–2 KB |
| `forge_health` | Runs every agent and sub-agent self-test plus an end-to-end build | ~1 KB |

## Agents and sub-agents

```
                         ┌──────────────── Orchestrator ────────────────┐
 prompt / spec ──► planner ─► material ─► optimizer ─► composer ─► modeler ─► animation ─► lighting ─► codegen ─► validator ──► files + summary
                                                                                                  reviewer ◄── forge_review (your code)
```

| Agent | Sub-agents | Job |
|---|---|---|
| **planner** | intent-parser · theme-expander · spec-normalizer | Reads counts, colours, materials, motion, lighting and quality words. Expands themes (forest, village, city, desert, space, cave, dining room…). Validates and clamps any spec |
| **material** | color-resolver · preset-mapper · material-dedup | Colour names/hex → PBR presets (metal, chrome, gold, glass, ice, ceramic, car paint, neon, lava, toon…). Identical materials are shared |
| **optimizer** | cost-estimator · instancing-advisor · budget-planner | Builds each model in real three.js to count triangles and parts. Repeated objects become `InstancedMesh` (400 trees = same draw calls as 10). Counts are trimmed to the quality budget |
| **composer** | layout-planner · environment-builder · camera-framer | Hero row at the centre, collision-free scatter rings around it, ground/terrain/lake basins, camera and orbit limits |
| **modeler** | primitive · procedural · parametric · environment modelers | 23 models: primitives, tree, rock, mushroom, crystal, house, car, robot, planet (+rings), vase (lathe), table, chair, lamp, water, ground, terrain, starfield |
| **animation** | motion-binder · loop-emitter | rotate, float, orbit, pulse, sway, bounce. Per object, per copy (phase-offset) or per instanced group. Emits only the cases used |
| **lighting** | rig-selector · shadow-configurator | studio, daylight, sunset, night, space and neon rigs. One shadow caster with a frustum fitted to the scene |
| **codegen** | module-emitter · html-emitter · model-emitter | r187 best practice: `outputColorSpace`, ACES tone mapping, PMREM `RoomEnvironment`, `Timer`, `setAnimationLoop`, capped pixel ratio, resize, `dispose()` |
| **validator** | syntax-validator · runtime-validator · budget-checker · best-practice-linter | Parses the output, **imports and runs it against real three.js in Node**, runs `update()` and `dispose()`, measures draw calls and triangles, lints |
| **reviewer** | syntax-checker · api-auditor · performance-auditor · correctness-auditor | Same rule engine, applied to your code |

## Token efficiency

- **No hidden LLM calls.** The agents are deterministic code, so a build costs only the tool call and its short reply. No sub-model is called and nothing is billed per agent.
- **Files go to disk; replies are summaries.** `forge_build` returns about 6 lines (paths, object list, draw calls, triangles, check results). Ask for code with `return_code: true` only when you need it inline.
- **Lean tool definitions** (~4.8 KB in total). They sit in every prompt, so a test guards their size.
- **Plan → edit → build.** `forge_plan` returns a ~300-char spec. Changing one field and rebuilding is cheaper than describing the whole scene again.
- **Cached plans and model costs.** Repeat prompts skip the planner, and model costs are measured once per process.
- **Lean output code.** Only the helpers, factories and animation cases a scene uses are emitted.
- **Ask for one `forge_catalog` section** (e.g. `models`) rather than `all`.

## Writing a spec

```json
{
  "title": "Night market",
  "quality": "medium",
  "lighting": { "preset": "night", "shadows": true },
  "environment": { "ground": "stone", "fog": true },
  "objects": [
    { "model": "robot", "color": "cyan", "preset": "metal", "animation": { "type": "float", "speed": 1.2 } },
    { "model": "house", "count": 5, "params": { "lit": true } },
    { "model": "lamp", "count": 4 },
    { "model": "tree", "count": 20, "params": { "style": "round" }, "scale": 1.2 },
    { "model": "sphere", "position": [3, 2, 0], "preset": "glass" }
  ]
}
```

- `quality` is `low`, `medium` or `high`. It sets pixel-ratio cap, antialiasing, shadow map size, and triangle and draw-call budgets.
- `ground` is `grass`, `sand`, `snow`, `stone`, `wood`, `matte`, `metal` or `none`.
- Every build also writes `spec.json`, so any scene can be rebuilt or tweaked exactly. Output is deterministic (seeded).

## Using the output

```js
import * as THREE from 'three';
import { createScene } from './scene.js';

const app = createScene(THREE, { aspect: innerWidth / innerHeight });
// your renderer / controls …
renderer.setAnimationLoop((t) => { timer.update(t); app.update(timer.getElapsed(), timer.getDelta()); renderer.render(app.scene, app.camera); });
// on unmount: app.dispose();
```

`app.settings` carries the recommended renderer settings (exposure, shadows, pixel-ratio cap, orbit target and limits). The generated `index.html` shows how to apply them.

## Checking your environment

```bash
npm run doctor              # env + deps, all 10 agents / 31 sub-agents, 4 full builds, file writes, MCP stdio round-trip
npm run doctor -- --browser # also renders a scene in headless Chromium (needs playwright)
npm run doctor -- --json    # machine-readable, for CI
npm test                    # node:test: every sub-agent, pipeline, all 23 models, reviewer, real MCP client
```

Any failure names the exact `agent/sub-agent` and the error. From inside an MCP client, call `forge_health`.

## Configuration

| Env var | Default | Meaning |
|---|---|---|
| `THREEJS_FORGE_OUT` | current dir | Base directory. `out_dir` / `out_file` / `file` must stay inside it |
| `THREEJS_FORGE_ALLOW_ANY_PATH` | unset | Set to `1` to allow paths outside the base directory |

Requires Node.js ≥ 18.17. Generated pages load three.js r187 from jsDelivr via an import map. They open straight from `file://`, with no build step.

## Project layout

```
src/server.js            MCP server (stdio) — 6 tools
src/core/orchestrator.js routes tasks through agents, caching, file output
src/core/agent.js        Agent / SubAgent base classes (delegate, trace, self-test)
src/core/sandbox.js      runs models in real three.js (Node) to measure them
src/agents/*.js          the 10 agents and their sub-agents
src/library/*.js         models, materials, lighting/animation/quality presets, review rules
bin/doctor.js            environment check
test/*.test.js           test suite
```
