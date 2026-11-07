import { Agent, SubAgent, assert } from '../core/agent.js';
import { lint, parse, extractScripts } from '../library/rules.js';

const GROUPS = {
  'api-auditor': { rules: ['removed-geometry', 'encoding-api', 'legacy-lights', 'pcf-soft-shadows', 'clock-deprecated', 'examples-jsm-path'], description: 'Removed / deprecated APIs (Geometry, encodings, legacy lights, PCFSoft, Clock, import paths).', sample: 'renderer.outputEncoding = THREE.sRGBEncoding;', expect: 'encoding-api' },
  'performance-auditor': { rules: ['pixel-ratio-uncapped', 'alloc-in-loop', 'mesh-in-for-loop', 'no-dispose', 'too-many-shadow-lights', 'set-animation-loop'], description: 'Per-frame allocations, draw calls, pixel ratio, GPU leaks, shadow cost.', sample: 'function animate(){ const v = new THREE.Vector3(); requestAnimationFrame(animate); } animate();', expect: 'alloc-in-loop' },
  'correctness-auditor': { rules: ['no-color-space', 'no-resize', 'shadows-not-enabled', 'legacy-shading-model'], description: 'Colour space, resize handling, shadow setup, PBR material choice.', sample: 'const r = new THREE.WebGLRenderer(); mesh.castShadow = true; addEventListener("resize", f);', expect: 'shadows-not-enabled' },
};

const SCORE = { error: 15, warn: 6, info: 2 };

export class ReviewerAgent extends Agent {
  constructor() {
    super({
      name: 'reviewer',
      role: 'Reviews existing three.js code and reports concrete, prioritised fixes.',
      subagents: [
        new SubAgent({
          name: 'syntax-checker',
          description: 'Parses JS/TS-free modules or HTML <script> blocks.',
          run: (src) => parse(extractScripts(src)).error || null,
          test: () => assert(parse('let x = ;').error && !parse('let x = 1;').error),
        }),
        ...Object.entries(GROUPS).map(([name, g]) => new SubAgent({
          name,
          description: g.description,
          run: (src) => lint(src, { only: g.rules }).findings.filter((x) => x.id !== 'syntax'),
          test: () => assert(lint(g.sample, { only: g.rules }).findings.some((x) => x.id === g.expect), `${name} should flag ${g.expect}`),
        })),
      ],
    });
  }

  async handle({ code, focus = 'all' }, ctx) {
    const syntaxError = await this.delegate('syntax-checker', code, ctx);
    const findings = [];
    if (syntaxError) findings.push({ id: 'syntax', severity: 'error', message: `Syntax error: ${syntaxError.message}`, line: syntaxError.line, fix: 'Fix syntax first; AST-based checks were skipped.' });
    const groups = focus === 'all' ? Object.keys(GROUPS) : Object.keys(GROUPS).filter((g) => g.startsWith(focus));
    for (const g of groups) findings.push(...(await this.delegate(g, code, ctx)));
    const order = { error: 0, warn: 1, info: 2 };
    findings.sort((a, b) => order[a.severity] - order[b.severity]);
    const score = Math.max(0, 100 - findings.reduce((s, x) => s + SCORE[x.severity], 0));
    return { score, findings };
  }
}
