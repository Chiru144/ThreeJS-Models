// Static-analysis rules for Three.js code. Used by the Reviewer agent (user code)
// and by the Validator agent (generated code). Each rule: (src, ast) -> findings[].
import * as acorn from 'acorn';

export function parse(src) {
  const opts = { ecmaVersion: 'latest', sourceType: 'module', locations: true, allowHashBang: true };
  try {
    return { ast: acorn.parse(src, opts) };
  } catch (e) {
    try {
      return { ast: acorn.parse(src, { ...opts, sourceType: 'script' }) };
    } catch {
      return { error: { message: e.message, line: e.loc?.line, column: e.loc?.column } };
    }
  }
}

/** Pull JS out of <script> tags when given HTML. */
export function extractScripts(src) {
  if (!/<script[\s>]/i.test(src)) return src;
  const parts = [];
  const re = /<script(?![^>]*type=["']importmap["'])(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(src))) parts.push(m[1]);
  return parts.join('\n;\n');
}

function walk(node, visit, parents = []) {
  if (!node || typeof node.type !== 'string') return;
  visit(node, parents);
  const next = [...parents, node];
  for (const key in node) {
    if (key === 'loc' || key === 'start' || key === 'end') continue;
    const v = node[key];
    if (Array.isArray(v)) for (const c of v) walk(c, visit, next);
    else if (v && typeof v.type === 'string') walk(v, visit, next);
  }
}

const calleeName = (n) => {
  const c = n.callee;
  if (!c) return '';
  if (c.type === 'Identifier') return c.name;
  if (c.type === 'MemberExpression' && c.property) return c.property.name || '';
  return '';
};
const newName = (n) => (n.callee?.type === 'MemberExpression' ? n.callee.property?.name : n.callee?.name) || '';
const isFn = (n) => /Function|ArrowFunction/.test(n.type);

/** Find function nodes that act as render loops. */
function loopFunctions(ast) {
  const loops = new Set();
  const named = new Map();
  walk(ast, (n) => {
    if (n.type === 'FunctionDeclaration' && n.id) named.set(n.id.name, n);
    if (n.type === 'VariableDeclarator' && n.id?.name && n.init && isFn(n.init)) named.set(n.id.name, n.init);
  });
  walk(ast, (n) => {
    if (n.type !== 'CallExpression') return;
    const name = calleeName(n);
    if (name !== 'requestAnimationFrame' && name !== 'setAnimationLoop') return;
    const a = n.arguments[0];
    if (!a) return;
    if (isFn(a)) loops.add(a);
    else if (a.type === 'Identifier' && named.has(a.name)) loops.add(named.get(a.name));
  });
  return loops;
}

const ALLOC_IN_LOOP = /(Geometry|Material|Texture|Mesh|Vector2|Vector3|Vector4|Matrix4|Quaternion|Euler|Color|Raycaster|Box3|Sphere)$/;
const HEAVY = /(Geometry|Material|Texture|Mesh)$/;

const f = (id, severity, message, fix, line) => ({ id, severity, message, fix, ...(line ? { line } : {}) });

export const RULES = [
  {
    id: 'removed-geometry', check: (src) => (/new\s+THREE\.Geometry\s*\(|\bTHREE\.Face3\b/.test(src)
      ? [f('removed-geometry', 'error', 'THREE.Geometry/Face3 were removed in r125.', 'Use THREE.BufferGeometry with BufferAttributes.')] : []),
  },
  {
    id: 'encoding-api', check: (src) => (/\boutputEncoding\b|\bsRGBEncoding\b|\.encoding\s*=/.test(src)
      ? [f('encoding-api', 'error', 'outputEncoding / sRGBEncoding / texture.encoding were removed (r162).', 'Use renderer.outputColorSpace = THREE.SRGBColorSpace and texture.colorSpace = THREE.SRGBColorSpace.')] : []),
  },
  {
    id: 'legacy-lights', check: (src) => (/physicallyCorrectLights|useLegacyLights/.test(src)
      ? [f('legacy-lights', 'error', 'physicallyCorrectLights/useLegacyLights were removed; lighting is physically based since r165.', 'Delete the flag and retune light intensities (directional ~1-3, point lights in candela).')] : []),
  },
  {
    id: 'pcf-soft-shadows', check: (src) => (/PCFSoftShadowMap/.test(src)
      ? [f('pcf-soft-shadows', 'warn', 'PCFSoftShadowMap was removed and falls back to PCFShadowMap (r180+).', 'Use THREE.PCFShadowMap (optionally with shadow.radius) or VSMShadowMap.')] : []),
  },
  {
    id: 'clock-deprecated', check: (src) => (/new\s+THREE\.Clock\s*\(/.test(src)
      ? [f('clock-deprecated', 'info', 'THREE.Clock is deprecated since r183.', 'Use THREE.Timer: timer.update(timestamp) each frame, then getDelta()/getElapsed().')] : []),
  },
  {
    id: 'examples-jsm-path', check: (src) => (/['"]three\/examples\/jsm\//.test(src)
      ? [f('examples-jsm-path', 'info', "Import path 'three/examples/jsm/' is legacy.", "Use 'three/addons/...' (same files, stable alias).")] : []),
  },
  {
    id: 'pixel-ratio-uncapped', check: (src) => (/setPixelRatio\(\s*(window\.)?devicePixelRatio\s*\)/.test(src)
      ? [f('pixel-ratio-uncapped', 'warn', 'Uncapped devicePixelRatio renders 9x the pixels on 3x phones.', 'renderer.setPixelRatio(Math.min(devicePixelRatio, 2)).')] : []),
  },
  {
    id: 'no-color-space', check: (src) => (/WebGLRenderer|WebGPURenderer/.test(src) && /\.map\s*=|TextureLoader/.test(src) && !/colorSpace/.test(src)
      ? [f('no-color-space', 'warn', 'Colour textures loaded without setting colorSpace look washed out.', 'texture.colorSpace = THREE.SRGBColorSpace for albedo/emissive maps (not normal/roughness maps).')] : []),
  },
  {
    id: 'no-resize', check: (src) => (/WebGLRenderer|WebGPURenderer/.test(src) && !/resize/i.test(src)
      ? [f('no-resize', 'warn', 'No resize handling: canvas will stretch when the window changes.', 'On resize: camera.aspect = w/h; camera.updateProjectionMatrix(); renderer.setSize(w, h).')] : []),
  },
  {
    id: 'shadows-not-enabled', check: (src) => (/castShadow\s*=\s*true/.test(src) && /WebGLRenderer|WebGPURenderer/.test(src) && !/shadowMap\.enabled\s*=/.test(src)
      ? [f('shadows-not-enabled', 'error', 'castShadow is set but renderer.shadowMap.enabled is never true.', 'renderer.shadowMap.enabled = true.')] : []),
  },
  {
    id: 'set-animation-loop', check: (src) => (/requestAnimationFrame\s*\(/.test(src) && /WebGLRenderer|WebGPURenderer/.test(src) && !/setAnimationLoop/.test(src)
      ? [f('set-animation-loop', 'info', 'Manual requestAnimationFrame loop.', 'Prefer renderer.setAnimationLoop(fn): required for WebXR and WebGPURenderer.')] : []),
  },
  {
    id: 'no-dispose', check: (src) => ((src.match(/new\s+THREE\.\w+(Geometry|Material)\b/g) || []).length > 8 && !/\.dispose\s*\(/.test(src)
      ? [f('no-dispose', 'info', 'Many geometries/materials and no dispose() calls.', 'Dispose geometries, materials and textures when removing objects or unmounting (React/SPA) to avoid GPU leaks.')] : []),
  },
  {
    id: 'legacy-shading-model', check: (src) => (/MeshPhongMaterial|MeshLambertMaterial/.test(src) && !/MeshStandardMaterial|MeshPhysicalMaterial/.test(src)
      ? [f('legacy-shading-model', 'info', 'Phong/Lambert materials do not respond to environment maps physically.', 'Use MeshStandardMaterial (+ scene.environment from PMREMGenerator) for realistic results.')] : []),
  },
  {
    id: 'alloc-in-loop',
    check: (_src, ast) => {
      if (!ast) return [];
      const out = [];
      for (const fn of loopFunctions(ast)) {
        walk(fn.body, (n) => {
          if (n.type !== 'NewExpression') return;
          const name = newName(n);
          if (!ALLOC_IN_LOOP.test(name)) return;
          const heavy = HEAVY.test(name);
          out.push(f('alloc-in-loop', heavy ? 'error' : 'warn',
            `new ${name}() inside the render loop allocates every frame${heavy ? ' and leaks GPU memory' : ' (GC stutter)'}.`,
            heavy ? 'Create it once outside the loop and reuse/update it.' : 'Hoist a reusable temp object outside the loop and use .set()/.copy().',
            n.loc?.start.line));
        });
      }
      return out;
    },
  },
  {
    id: 'mesh-in-for-loop',
    check: (_src, ast) => {
      if (!ast) return [];
      const out = [];
      walk(ast, (n, parents) => {
        if (n.type !== 'NewExpression' || newName(n) !== 'Mesh') return;
        if (parents.some((p) => /^(For|ForOf|ForIn|While)Statement$/.test(p.type)) ||
          parents.some((p) => p.type === 'CallExpression' && /^(forEach|map)$/.test(calleeName(p)))) {
          out.push(f('mesh-in-for-loop', 'info', 'Meshes created in a loop: each one is a draw call.',
            'If they share geometry+material, use THREE.InstancedMesh (one draw call) or BatchedMesh.', n.loc?.start.line));
        }
      });
      return out.slice(0, 1);
    },
  },
  {
    id: 'too-many-shadow-lights',
    check: (src) => ((src.match(/\w+Light[^;\n]*\n?[^;\n]*castShadow\s*=\s*true|light\w*\.castShadow\s*=\s*true/gi) || []).length > 3
      ? [f('too-many-shadow-lights', 'warn', 'More than 3 shadow-casting lights.', 'Each shadow light re-renders the scene; keep 1-2 (a key DirectionalLight).')] : []),
  },
];

const ORDER = { error: 0, warn: 1, info: 2 };

/** Run rules. `only` limits to rule ids; returns { syntaxError?, findings[] } */
export function lint(src, { only } = {}) {
  const js = extractScripts(src);
  const { ast, error } = parse(js);
  const findings = [];
  if (error) findings.push(f('syntax', 'error', `Syntax error: ${error.message}`, 'Fix the syntax first; other checks may be incomplete.', error.line));
  for (const r of RULES) {
    if (only && !only.includes(r.id)) continue;
    try { findings.push(...r.check(js, ast)); } catch { /* a rule must never crash the review */ }
  }
  findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return { syntaxError: error, findings };
}
