// PBR material presets + colour names used by the Material agent.

export const MATERIAL_PRESETS = {
  plastic: { type: 'MeshStandardMaterial', props: { roughness: 0.4, metalness: 0 }, words: ['plastic', 'glossy'] },
  matte: { type: 'MeshStandardMaterial', props: { roughness: 1, metalness: 0 }, words: ['matte', 'clay', 'flat'] },
  metal: { type: 'MeshStandardMaterial', props: { roughness: 0.3, metalness: 1 }, words: ['metal', 'metallic', 'steel', 'iron', 'silver'] },
  chrome: { type: 'MeshStandardMaterial', props: { color: 0xffffff, roughness: 0.04, metalness: 1 }, words: ['chrome', 'mirror', 'polished'] },
  gold: { type: 'MeshStandardMaterial', props: { color: 0xffc356, roughness: 0.2, metalness: 1 }, words: ['gold', 'golden'] },
  copper: { type: 'MeshStandardMaterial', props: { color: 0xc8744a, roughness: 0.3, metalness: 1 }, words: ['copper', 'bronze', 'brass'] },
  wood: { type: 'MeshStandardMaterial', props: { color: 0x8b5a2b, roughness: 0.75 }, words: ['wood', 'wooden', 'timber'] },
  stone: { type: 'MeshStandardMaterial', props: { color: 0x8a8580, roughness: 0.95, flatShading: true }, words: ['stony', 'concrete', 'marble'] },
  glass: { type: 'MeshPhysicalMaterial', props: { color: 0xffffff, roughness: 0.03, metalness: 0, transmission: 1, thickness: 0.5, ior: 1.5 }, words: ['glass', 'transparent', 'clear'] },
  ice: { type: 'MeshPhysicalMaterial', props: { color: 0xcfefff, roughness: 0.15, transmission: 0.8, thickness: 1, ior: 1.31 }, words: ['ice', 'icy', 'frozen'] },
  ceramic: { type: 'MeshPhysicalMaterial', props: { roughness: 0.25, clearcoat: 0.8 }, words: ['ceramic', 'porcelain'] },
  carpaint: { type: 'MeshPhysicalMaterial', props: { metalness: 0.6, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.1 }, words: ['car paint', 'lacquer', 'shiny'] },
  water: { type: 'MeshPhysicalMaterial', props: { color: 0x2a7fbf, roughness: 0.08, metalness: 0.1, transmission: 0.5, thickness: 1 }, words: ['watery'] },
  rubber: { type: 'MeshStandardMaterial', props: { color: 0x1a1a1a, roughness: 0.9 }, words: ['rubber'] },
  neon: { type: 'MeshStandardMaterial', props: { emissiveIntensity: 2.5, roughness: 0.4 }, emissive: true, words: ['neon', 'glowing', 'glow', 'emissive', 'luminous'] },
  lava: { type: 'MeshStandardMaterial', props: { color: 0x331100, emissive: 0xff4a00, emissiveIntensity: 2, roughness: 0.8 }, words: ['lava', 'molten', 'magma'] },
  toon: { type: 'MeshToonMaterial', props: {}, words: ['toon', 'cartoon', 'cel'] },
  grass: { type: 'MeshStandardMaterial', props: { color: 0x5f8f45, roughness: 1 }, words: ['grass', 'grassy'] },
  sand: { type: 'MeshStandardMaterial', props: { color: 0xd8c08a, roughness: 1 }, words: ['sand', 'sandy'] },
  snow: { type: 'MeshStandardMaterial', props: { color: 0xf4f8ff, roughness: 0.9 }, words: ['snow', 'snowy'] },
};

export const COLORS = {
  red: 0xd33b2f, crimson: 0xb3122e, orange: 0xf28c28, amber: 0xffbf00, yellow: 0xf2d230, gold: 0xffc356,
  lime: 0x9be22d, green: 0x3c9a3c, emerald: 0x1f9e6e, teal: 0x1aa39a, cyan: 0x22c7e0, turquoise: 0x30d5c8,
  blue: 0x2f6fd8, navy: 0x1d2a5a, indigo: 0x4b3fb0, purple: 0x8a3fc7, violet: 0x9b5de5, magenta: 0xe03aa8,
  pink: 0xf28bb3, brown: 0x7a4a26, beige: 0xe6d5b8, tan: 0xc8a97e, white: 0xf5f5f5, black: 0x161616,
  gray: 0x808080, grey: 0x808080, silver: 0xc0c4c8, charcoal: 0x333438, ivory: 0xfff8e7, cream: 0xf3e9d2,
  maroon: 0x6b1c23, olive: 0x707a2c, mint: 0x9fe3c2, coral: 0xff7f61, salmon: 0xf08a73, lavender: 0xb7a6e6,
};

/** Accepts colour names, "#rgb", "#rrggbb", "0xrrggbb" or numbers. Returns int or undefined. */
export function resolveColor(c) {
  if (c == null) return undefined;
  if (typeof c === 'number' && Number.isFinite(c)) return c & 0xffffff;
  const s = String(c).trim().toLowerCase();
  if (s in COLORS) return COLORS[s];
  let m = s.match(/^#([0-9a-f]{6})$/) || s.match(/^0x([0-9a-f]{6})$/);
  if (m) return parseInt(m[1], 16);
  m = s.match(/^#([0-9a-f]{3})$/);
  if (m) return parseInt(m[1].split('').map((ch) => ch + ch).join(''), 16);
  return undefined;
}

export const MATERIAL_WORDS = (() => {
  const map = new Map();
  for (const [name, p] of Object.entries(MATERIAL_PRESETS)) for (const w of p.words) map.set(w, name);
  return map;
})();
