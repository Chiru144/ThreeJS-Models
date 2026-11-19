// Character agent: plans a person the way a character artist would — archetype,
// anatomy (head-unit proportions), appearance, wardrobe, pose — then inspects the
// rigged result in real three.js before it goes into the scene.
import { Agent, SubAgent, assert } from '../core/agent.js';
import { ARCHETYPES, AGES, BUILDS, SKIN_TONES, HAIR_COLORS, EYE_COLORS } from '../library/characters.js';
import { COLORS, resolveColor } from '../library/materials.js';
import { buildModel, measure } from '../core/sandbox.js';

const hash = (s) => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
const pickBy = (seed, arr) => arr[seed % arr.length];
const has = (text, re) => re.test(text);
const COLOR_WORDS = Object.keys(COLORS).concat(['golden', 'blond', 'blonde', 'ginger', 'auburn', 'platinum', 'dark', 'light', 'denim', 'leather', 'khaki', 'camo', 'tweed', 'corduroy', 'velvet', 'silk', 'wool']);
const MATERIAL_COLORS = { denim: 0x3b5578, leather: 0x2a1d17, khaki: 0xb5a27a, camo: 0x5b6640, tweed: 0x6b5a45, corduroy: 0x7a5232, velvet: 0x5a1a3a, silk: 0xe8dcc8, wool: 0x8a8070 };
const colorOf = (w) => MATERIAL_COLORS[w] ?? resolveColor(w === 'golden' ? 'gold' : w) ?? HAIR_COLORS[w];

/** Free text -> raw traits (only what the user actually said). */
function readTraits(text) {
  let t = ` ${String(text || '').toLowerCase().replace(/[^a-z0-9#\s-]/g, ' ')} `;
  const tr = {};
  // hair first, so "short red hair" does not become "short person in red"; the colour may sit before any
  // hairstyle word ("blonde ponytail", "grey bun", "red braids")
  const HAIR_NOUN = 'hair|haired|ponytail|pony tail|bun|braids|braid|braided hair|pigtails|curls|afro|bob|mohawk|dreadlocks|locks';
  const hairRe = new RegExp(`\\b((?:long|short|curly|wavy|straight|spiky|messy|braided|shoulder-length|cropped)\\s+)?((?:${Object.keys(HAIR_COLORS).sort((a, b) => b.length - a.length).join('|')})\\s+)?((?:long|short|curly|wavy|spiky|straight)\\s+)?(${HAIR_NOUN})\\b`);
  const hm = t.match(hairRe);
  if (hm) {
    const style = (hm[1] || hm[3] || '').trim();
    if (hm[2]) tr.hairColor = HAIR_COLORS[hm[2].trim()];
    if (style) tr.hair = { long: 'long', 'shoulder-length': 'bob', short: 'short', cropped: 'short', curly: 'curly', wavy: 'long', straight: 'long', spiky: 'spiky', messy: 'spiky', braided: 'braid' }[style];
    if (hm[4] !== 'hair' && hm[4] !== 'haired') t = t.replace(hm[2] || '', ' '); else t = t.replace(hm[0], ' '); // keep the style noun for the style table
  }
  const styles = { bald: 'bald', ponytail: 'ponytail', 'pony tail': 'ponytail', pigtails: 'pigtails', braid: 'braid', braids: 'braid', bun: 'bun', afro: 'afro', mohawk: 'mohawk', 'buzz cut': 'buzz', buzzcut: 'buzz', 'crew cut': 'buzz', bob: 'bob', dreadlocks: 'long', curls: 'curly' };
  for (const [w, st] of Object.entries(styles)) if (has(t, new RegExp(`\\b${w}\\b`))) tr.hair = st;
  const eye = t.match(new RegExp(`\\b(${Object.keys(EYE_COLORS).join('|')})[ -](eyes|eyed)\\b`));
  if (eye) { tr.eyeColor = EYE_COLORS[eye[1]]; t = t.replace(eye[0], ' '); }
  const skin = t.match(new RegExp(`\\b(${Object.keys(SKIN_TONES).join('|')}|tanned|black|white)[ -](skin|skinned|complexion)\\b`));
  if (skin) { tr.skin = SKIN_TONES[{ tanned: 'tan', black: 'deep', white: 'fair' }[skin[1]] || skin[1]]; t = t.replace(skin[0], ' '); }

  if (has(t, /\b(baby|toddler|infant)\b/)) tr.age = 'toddler';
  else if (has(t, /\b(teen|teens|teenager|teenagers|teenage|adolescent)\b/)) tr.age = 'teen'; // "teenage boy" is a teen, not a child
  else if (has(t, /\b(child|kid|kids|children|little (boy|girl)|boy|girl|young (boy|girl))\b/)) tr.age = 'child';
  else if (has(t, /\byoung (person|people)\b/)) tr.age = 'teen';
  else if (has(t, /\b(old|elderly|aged|senior|grandma|grandpa|grandmother|grandfather|ancient)\b/)) tr.age = 'elder';
  if (has(t, /\b(woman|women|female|lady|girl|girls|she|her|queen|princess|mother|mom|grandma|grandmother|witch|sorceress|businesswoman|nurse|actress)\b/)) tr.sex = 'female';
  else if (has(t, /\b(man|men|male|guy|boy|boys|he|his|king|prince|father|dad|grandpa|grandfather|gentleman|businessman|bearded)\b/)) tr.sex = 'male';
  if (has(t, /\b(slim|thin|skinny|slender|lanky|petite)\b/)) tr.build = 'slim';
  if (has(t, /\b(muscular|athletic|strong|fit|buff|brawny|burly)\b/)) tr.build = 'athletic';
  if (has(t, /\b(fat|heavy|chubby|stocky|overweight|plump|round|portly)\b/)) tr.build = 'heavy';
  if (has(t, /\b(tall|towering)\b/)) tr.heightK = 1.09;
  if (has(t, /\b(short)\b/)) tr.heightK = 0.91;
  if (has(t, /\b(shaved|shaven|bald|clean-shaven) head\b|\bskinhead\b/)) tr.hair = 'bald';
  const bc = t.match(new RegExp(`\\b(${Object.keys(HAIR_COLORS).sort((a, b) => b.length - a.length).join('|')})\\s+(beard|mustache|moustache|goatee|stubble)\\b`));
  if (bc) tr.beardColor = HAIR_COLORS[bc[1]];
  if (has(t, /\bfreckle(s|d)\b/)) tr.freckles = true;
  if (has(t, /\bbeard(ed)?\b/)) tr.beard = has(t, /\b(short|trimmed) beard\b/) ? 'goatee' : 'full';
  if (has(t, /\b(mustache|moustache)\b/)) tr.beard = 'mustache';
  if (has(t, /\bgoatee\b/)) tr.beard = 'goatee';
  if (has(t, /\bstubble|unshaven\b/)) tr.beard = 'stubble';
  if (has(t, /\bclean[ -]shaven\b/)) tr.beard = 'none';
  if (has(t, /\bsunglasses\b/)) tr.glasses = 'sunglasses';
  else if (has(t, /\b(glasses|spectacles|specs)\b/)) tr.glasses = 'glasses';
  if (has(t, /\b(pointy|pointed|elven|elf) ears\b/)) tr.ears = 'pointy';
  return { traits: tr, rest: t };
}

const GARMENTS = [
  // [regex word, outfit or null, which colour slot]
  ['t-?shirts?|tees?', 'tshirt', 'top'], ['shirts?|blouses?|tops?(?! hats?)', null, 'top'], ['tank tops?', 'sport', 'top'], ['jackets?|coats?|blazers?', null, 'top'],
  ['sweaters?|jumpers?|cardigans?', 'sweater', 'top'], ['hoodies?|hooded sweatshirt', 'hoodie', 'top'], ['vests?', null, 'top'],
  ['suits?|tuxedos?|tux', 'suit', 'top'], ['gowns?', 'robe', 'top'], ['dress(es)?|sundress', 'dress', 'top'], ['robes?', 'robe', 'top'],
  ['armou?r|plate armou?r|chainmail', 'armor', 'accent'], ['uniforms?', 'uniform', 'top'], ['lab coats?', 'labcoat', 'top'], ['space ?suits?', 'spacesuit', 'top'],
  ['rags|tattered clothes|torn clothes', 'rags', 'top'], ['sportswear|tracksuits?|gym clothes|jersey', 'sport', 'top'],
  ['jeans|pants|trousers|slacks|leggings', null, 'bottom'], ['shorts', null, 'bottom'], ['skirts?', null, 'bottom'],
  ['shoes|boots|sneakers|trainers|heels|sandals', null, 'shoes'],
];
const HAT_WORDS = [['top hats?', 'tophat'], ['wizard hats?|pointy hats?|witch hats?', 'wizard'], ['cowboy hats?|stetsons?', 'cowboy'], ['hard ?hats?', 'hardhat'], ['chef hats?|toques?', 'chef'], ['pirate hats?|tricorns?', 'pirate'], ['crowns?|tiaras?', 'crown'], ['helmets?', 'helmet'], ['beanies?|wool hats?', 'beanie'], ['baseball caps?|caps?', 'cap'], ['hoods?|hooded', 'hood'], ['hats?', 'cap']];
const PROP_WORDS = [['canes?|walking sticks?', 'cane'], ['sword and shield', 'swordshield'], ['swords?|blades?|katana', 'sword'], ['staffs?|staves', 'staff'], ['wands?', 'wand'], ['shields?', 'shield'], ['torch(es)?', 'torch'], ['books?', 'book'], ['briefcases?', 'briefcase']];

function readWardrobe(rest) {
  const w = {};
  const pr = rest.match(/\b(plaid|tartan|flannel|striped|stripes|stripy|pinstriped?|checkered|chequered|checked|gingham|polka[ -]dots?|polka[ -]dotted|spotted)\b/);
  if (pr) w.print = /plaid|tartan|flannel/.test(pr[1]) ? 'plaid' : /stripe|stripy/.test(pr[1]) ? 'stripes' : /check|chequer|gingham/.test(pr[1]) ? 'checks' : 'dots';
  const colorRe = `(?:(${COLOR_WORDS.join('|')})\\s+)?`;
  for (const [re, outfit, slot] of GARMENTS) {
    const m = rest.match(new RegExp(`\\b${colorRe}(?:[a-z]+\\s+)?(${re})\\b`));
    if (!m) continue;
    rest = rest.replace(m[0], ' , '); // consumed: "green hoodie jeans" must not give the jeans the hoodie's colour
    if (outfit && !(w.outfit && outfit === 'tshirt')) w.outfit = outfit;
    if (/^shorts$/.test(m[2])) w.shorts = true;
    if (/^skirts?$/.test(m[2])) w.skirt = true;
    if (m[1]) w[slot] = colorOf(m[1]);
    else if (/^jeans$/.test(m[2]) && w.bottom === undefined) w.bottom = MATERIAL_COLORS.denim; // jeans are denim unless a colour is given
  }
  const tie = rest.match(new RegExp(`\\b${colorRe}(?:neck)?ties?\\b`));
  if (tie && tie[1]) w.accent = colorOf(tie[1]);
  if (/\bstethoscopes?\b/.test(rest)) w.stethoscope = true;
  for (const [re, hat] of HAT_WORDS) {
    const m = rest.match(new RegExp(`\\b${colorRe}(${re})\\b`));
    if (m) { w.hat = hat; if (m[1]) w.hatColor = colorOf(m[1]); break; }
  }
  for (const [re, prop] of PROP_WORDS) if (new RegExp(`\\b(${re})\\b`).test(rest)) { w.prop = prop; break; }
  const cape = rest.match(new RegExp(`\\b${colorRe}(capes?|cloaks?|mantles?)\\b`));
  if (cape) w.cape = cape[1] ? colorOf(cape[1]) : 0x8c1d1d;
  const dressedIn = rest.match(new RegExp(`\\b(?:in|wearing|dressed in|clad in)\\s+(${COLOR_WORDS.join('|')})\\b(?!\\s+(?:${GARMENTS.map((g) => g[0]).join('|')}))`));
  if (dressedIn && w.top === undefined) w.top = colorOf(dressedIn[1]);
  if (w.outfit === 'armor' && /\b(golden|gold) armou?r\b/.test(rest)) w.accent = 0xffc356;
  return w;
}

// ---- description fidelity: what in the request was understood, what was not, and what got overridden ----
const STOP = new Set('a an the with and or in of on at to for by from as is are was be being his her their its my your our this that these those who which while very quite rather some any each one two three pair set wearing wears worn holding holds carrying carries dressed clad having has have looking looks standing stands person people character figure style styled realistic detailed high quality model render make create please wearing also just like plus'.split(' '));
const ANIM_WORDS = 'idle walk walks walking run runs running jog jogging wave waves waving dance dances dancing ride rides riding fly flying swim swimming bounce bouncing zombie shambling'.split(' ');
let KNOWN = null;
function knownWords() {
  if (KNOWN) return KNOWN;
  const src = [readTraits, readWardrobe, planAppearance, planWardrobe].map((f) => f.toString()).join(' ') + JSON.stringify([GARMENTS, HAT_WORDS, PROP_WORDS]);
  KNOWN = new Set([...src.toLowerCase().match(/[a-z]{3,}/g), ...COLOR_WORDS, ...Object.keys(HAIR_COLORS).flatMap((k) => k.split(' ')), ...Object.keys(EYE_COLORS).flatMap((k) => k.split(' ')),
    ...Object.keys(SKIN_TONES), ...Object.keys(ARCHETYPES), ...Object.keys(ARCHETYPES).map((a) => `${a}s`), ...ANIM_WORDS, 'hair', 'eyes', 'skin', 'head', 'ears', 'face', 'clothes', 'outfit', 'hat', 'mustache', 'moustache']);
  return KNOWN;
}
function checkFidelity({ description, traits, wardrobe, params }) {
  const words = String(description || '').toLowerCase().match(/[a-z][a-z-]*[a-z]/g) || [];
  const content = words.filter((w) => w.length > 2 && !STOP.has(w));
  const known = knownWords();
  const isKnown = (w) => [w, w.replace(/(es|s)$/, ''), `${w}s`, `${w}es`, w.replace(/-/g, '')].some((q) => known.has(q));
  const ignored = [...new Set(content.filter((w) => !isKnown(w)))];
  const conflicts = [];
  const same = (a, b) => a === undefined || b === undefined || a === b;
  if (!same(traits.hair, params.hair)) conflicts.push(`hair "${traits.hair}" became "${params.hair}"`);
  if (!same(traits.hairColor, params.hairColor) && params.beardColor === undefined) conflicts.push('hair colour was overridden');
  if (!same(traits.age, params.age)) conflicts.push(`age "${traits.age}" became "${params.age}"`);
  if (!same(traits.sex, params.sex)) conflicts.push(`sex "${traits.sex}" became "${params.sex}"`);
  for (const k of ['top', 'bottom', 'shoes', 'hat', 'prop', 'outfit']) if (!same(wardrobe[k], params[k])) conflicts.push(`${k} was overridden`);
  const understood = content.length ? (content.length - ignored.length) / content.length : 1;
  return { understood: Math.round(understood * 100), ignored, conflicts };
}

/** Archetype defaults < user traits. */
function resolveArchetype({ params = {}, description = '' }) {
  const text = ` ${description.toLowerCase()} `;
  // a more specific archetype mentioned in the description wins over a generic one
  let name = params.archetype && ARCHETYPES[params.archetype] ? params.archetype : 'person';
  for (const a of Object.keys(ARCHETYPES).sort((x, y) => y.length - x.length)) {
    if (Object.keys(ARCHETYPES[a]).length > 2 && new RegExp(`\\b${a}s?\\b`).test(text)) { name = a; break; }
  }
  const base = { ...ARCHETYPES[name] };
  if (typeof base.skin === 'string') base.skin = SKIN_TONES[base.skin];
  return { archetype: name, base };
}

function planAnatomy({ base, traits, explicit, seed }) {
  const age = explicit.age || traits.age || base.age || 'adult';
  const sex = explicit.sex || traits.sex || base.sex || 'neutral';
  const build = explicit.build || traits.build || base.build || 'average';
  const A = AGES[age], B = BUILDS[build];
  let height = base.height ?? A.height;
  if (age !== 'toddler' && age !== 'child') height *= sex === 'male' ? 1.03 : sex === 'female' ? 0.96 : 1;
  height *= traits.heightK ?? 1;
  height *= 0.97 + ((seed % 1000) / 1000) * 0.06; // natural individual variation
  return {
    age, sex, build,
    height: +(explicit.height ?? height).toFixed(2),
    headUnits: explicit.headUnits ?? base.headUnits ?? A.headUnits,
    legRatio: explicit.legRatio ?? A.legRatio,
    girth: explicit.girth ?? B.girth * (sex === 'female' ? 0.96 : 1),
    shoulders: explicit.shoulders ?? B.shoulders,
  };
}

const REAL_SKIN = ['pale', 'fair', 'light', 'medium', 'olive', 'tan', 'brown', 'dark', 'deep'];
const REAL_HAIR = ['black', 'dark brown', 'brown', 'chestnut', 'auburn', 'blonde', 'red'];

function planAppearance({ base, traits, explicit, anatomy, seed, crowd }) {
  const out = {};
  const pick = (k, fallback) => explicit[k] ?? traits[k] ?? base[k] ?? fallback;
  out.skin = pick('skin', SKIN_TONES[pickBy(seed, REAL_SKIN)]);
  const elderHair = anatomy.age === 'elder' ? pickBy(seed >>> 3, [0x9a9a9a, 0xc8c8cc, 0xeeeeee]) : null;
  out.hairColor = pick('hairColor', elderHair ?? HAIR_COLORS[pickBy(seed >>> 5, REAL_HAIR)]);
  const defaultHair = anatomy.sex === 'female' ? pickBy(seed >>> 7, ['long', 'ponytail', 'bun', 'bob', 'long', 'curly'])
    : anatomy.sex === 'male' ? pickBy(seed >>> 7, ['short', 'short', 'buzz', 'curly', 'spiky']) : pickBy(seed >>> 7, ['short', 'bob', 'curly', 'ponytail']);
  out.hair = pick('hair', anatomy.age === 'elder' && anatomy.sex === 'male' && seed % 3 === 0 ? 'bald' : defaultHair);
  out.eyeColor = pick('eyeColor', Object.values(EYE_COLORS)[(seed >>> 9) % 6]);
  out.beard = pick('beard', 'none');
  out.glasses = pick('glasses', crowd && anatomy.age === 'elder' && seed % 2 ? 'glasses' : 'none'); // a single character only wears what was asked for
  const beardC = explicit.beardColor ?? traits.beardColor;
  if (beardC !== undefined) { if (explicit.hairColor === undefined && traits.hairColor === undefined) out.hairColor = beardC; else if (beardC !== out.hairColor) out.beardColor = beardC; }
  if (explicit.freckles ?? traits.freckles) out.freckles = true;
  for (const k of ['ears', 'earScale', 'noseScale', 'tusks', 'eyeScale']) if (pick(k) !== undefined) out[k] = pick(k);
  if (crowd) {
    out.vary = true;
    out.varySex = explicit.varySex ?? (!explicit.sex && !traits.sex && !base.sex);
    out.varySkin = explicit.varySkin ?? (explicit.skin === undefined && traits.skin === undefined && base.skin === undefined);
    out.varyHair = explicit.varyHair ?? (!explicit.hair && !traits.hair && !traits.hairColor);
  }
  return out;
}

function planWardrobe({ base, wardrobe, explicit, seed, crowd, anatomy }) {
  const pick = (k, fallback) => explicit[k] ?? wardrobe[k] ?? base[k] ?? fallback;
  const PALETTE = [0x2f4f7f, 0x8c2f39, 0x2e6b4f, 0xd9c7a1, 0x444444, 0xe8e8e8, 0x6b4f8f, 0xc8742f];
  const out = {
    outfit: pick('outfit', anatomy.age === 'child' || anatomy.age === 'teen' ? pickBy(seed >>> 2, ['tshirt', 'hoodie', 'casual']) : 'casual'),
    top: pick('top', PALETTE[(seed >>> 4) % PALETTE.length]),
    bottom: pick('bottom', [0x2b3a55, 0x3b3b3b, 0x5a4632, 0x1d1d22][(seed >>> 6) % 4]),
    shoes: pick('shoes', 0x2a2420),
  };
  for (const k of ['hat', 'hatColor', 'prop', 'cape', 'accent', 'shorts', 'skirt', 'stethoscope', 'print']) if (pick(k) !== undefined) out[k] = pick(k);
  if (crowd) out.varyClothes = explicit.varyClothes ?? (wardrobe.top === undefined && explicit.top === undefined && base.top === undefined);
  return out;
}

const RIG_MODES = ['idle', 'walk', 'run', 'wave', 'dance'];
function planPose({ object, base, count }) {
  const a = object.animation?.type;
  const map = { fly: 'walk', swim: 'walk', slither: 'walk', bounce: 'dance' };
  const type = a ? (RIG_MODES.includes(a) ? a : map[a] ?? a) : count <= 3 ? 'idle' : null;
  return { pose: base.pose ?? object.params?.pose ?? 'normal', animation: type ? { ...(object.animation || {}), type, speed: object.animation?.speed ?? 1 } : null };
}

const inspected = new Map();
function inspectRig(params, style = 'realistic') {
  const key = style + JSON.stringify(params);
  if (inspected.has(key)) return inspected.get(key);
  const { obj } = buildModel('human', params, undefined, style);
  const stats = measure(obj);
  assert(stats.finite, 'non-finite transforms');
  assert(typeof obj.userData.rig === 'function', 'missing rig');
  for (const mode of RIG_MODES) { obj.userData.rig(1.234, mode); assert(measure(obj).finite, `rig mode ${mode} produced NaN`); }
  obj.userData.rig(0, 'idle');
  // measured height must match the anatomy plan (feet on the ground, head at the top)
  const pts = [];
  obj.updateMatrixWorld(true);
  obj.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); pts.push(b.min.y, b.max.y); } });
  const minY = Math.min(...pts), topY = Math.max(...pts);
  const r = { ...stats, minY: +minY.toFixed(3), topY: +topY.toFixed(3) };
  inspected.set(key, r);
  return r;
}

// "a knight riding a horse", "a girl walking her dog", "a man with his dog"
const MOUNT_RE = /\b(riding|rides|on|astride|mounted on|atop|on top of|on the back of)\s*(a|an|the|his|her|their)?\s*$/;
const LEAD_RE = /\b(walking|leading|with|and|walks|holding the leash of)\s*(a|an|the|his|her|their)?\s*$/;
const RIDEABLE = (o) => o.model === 'quadruped' && (o.params.bodyLen ?? 0) * (o.scale ?? 1) >= 0.9;
const COMPANION = (o) => (o.model === 'quadruped' && (o.params.bodyLen ?? 1) * (o.scale ?? 1) < 0.9) || (o.model === 'bird' && o.params.flightless);

function planRelations(objects) {
  const links = [];
  objects.forEach((o, i) => {
    const next = objects[i + 1];
    if (o.model !== 'human' || o.count !== 1 || !next || next.count !== 1) return;
    const d = (o.description || '').trim();
    if (RIDEABLE(next) && MOUNT_RE.test(d)) links.push({ child: o.id, parent: next.id, kind: 'rider' });
    else if (COMPANION(next) && LEAD_RE.test(d)) links.push({ child: next.id, parent: o.id, kind: 'companion' });
  });
  return links;
}

const hexName = (n) => `#${n.toString(16).padStart(6, '0')}`;
function sheet(p, anim) {
  const parts = [
    `${p.archetype !== 'person' ? `${p.archetype}, ` : ''}${p.age} ${p.sex === 'neutral' ? 'person' : p.sex}, ${p.height} m (${p.headUnits} heads), ${p.build}`,
    `skin ${hexName(p.skin)} · ${p.hair} hair ${hexName(p.hairColor)} · eyes ${hexName(p.eyeColor)}${p.beard !== 'none' ? ` · ${p.beard} beard` : ''}${p.glasses !== 'none' ? ` · ${p.glasses}` : ''}${p.ears === 'pointy' ? ' · pointed ears' : ''}`,
    `${p.outfit === 'armor' ? `armor ${hexName(p.accent ?? 0xb8bcc4)}` : `${p.outfit} (top ${hexName(p.top)}, bottom ${hexName(p.bottom)})`}${p.hat && p.hat !== 'none' ? ` · ${p.hat}` : ''}${p.cape ? ' · cape' : ''}${p.prop && p.prop !== 'none' ? ` · ${p.prop}` : ''}`,
    `pose ${anim?.type ?? 'static'}${p.vary ? ' · varied crowd' : ''}`,
  ];
  return parts.join(' | ');
}

export class CharacterAgent extends Agent {
  constructor() {
    super({
      name: 'character',
      role: 'Plans people like a character artist (archetype, anatomy, appearance, wardrobe, pose) and inspects the rigged result.',
      subagents: [
        new SubAgent({
          name: 'archetype-resolver',
          description: '42 archetypes (knight, wizard, chef, astronaut, elf, orc, zombie…) as starting traits.',
          run: (input) => resolveArchetype(input),
          test: () => {
            const r = resolveArchetype({ params: { archetype: 'person' }, description: 'an old wizard with a staff' });
            assert(r.archetype === 'wizard' && r.base.hat === 'wizard', 'wizard');
          },
        }),
        new SubAgent({
          name: 'anatomy-planner',
          description: 'Age, sex and build → height, head-unit proportions, leg ratio, girth, shoulders.',
          run: (input) => planAnatomy(input),
          test: () => {
            const a = planAnatomy({ base: {}, traits: { age: 'child' }, explicit: {}, seed: 1 });
            const b = planAnatomy({ base: {}, traits: { sex: 'male', build: 'athletic' }, explicit: {}, seed: 1 });
            assert(a.headUnits < 6 && a.height < 1.4 && b.height > 1.7 && b.shoulders > 1.1, 'proportions');
          },
        }),
        new SubAgent({
          name: 'appearance-planner',
          description: 'Skin tone, hair style/colour, eye colour, facial hair, glasses, ears (reads free text).',
          run: (input) => planAppearance(input),
          test: () => {
            const { traits } = readTraits('a tall woman with long red hair, green eyes and glasses');
            assert(readWardrobe(' a chubby boy in a green hoodie jeans ').bottom === 0x3b5578, 'colour bleeding between garments');
            assert(readWardrobe(' a man wearing a red plaid shirt ').print === 'plaid', 'print');
            assert(readTraits('a girl with a blonde ponytail').traits.hairColor === HAIR_COLORS.blonde && readTraits('a girl with a blonde ponytail').traits.hair === 'ponytail' && readTraits('red braids').traits.hair === 'braid', 'hair noun colours');
            assert(readTraits('long dark hair').traits.hair === 'long' && readTraits('a man with dark brown hair').traits.hairColor === HAIR_COLORS['dark brown'], 'dark hair');
            assert(traits.hair === 'long' && traits.hairColor === HAIR_COLORS.red && traits.eyeColor === EYE_COLORS.green && traits.glasses === 'glasses' && traits.sex === 'female' && traits.heightK > 1, JSON.stringify(traits));
            const ap = planAppearance({ base: {}, traits, explicit: {}, anatomy: { age: 'adult', sex: 'female' }, seed: 3 });
            assert(ap.hairColor === HAIR_COLORS.red, 'appearance');
          },
        }),
        new SubAgent({
          name: 'wardrobe-planner',
          description: 'Outfit, garment colours, hat, cape and held prop.',
          run: (input) => planWardrobe(input),
          test: () => {
            const w = readWardrobe(readTraits('a man in a black suit and red shoes wearing a top hat holding a sword').rest);
            assert(w.outfit === 'suit' && w.top === COLORS.black && w.shoes === COLORS.red && w.hat === 'tophat' && w.prop === 'sword', JSON.stringify(w));
          },
        }),
        new SubAgent({
          name: 'description-fidelity',
          description: 'Checks the plan against the request: lists words nothing understood and traits an archetype overrode, so nothing is dropped silently.',
          run: (input) => checkFidelity(input),
          test: () => {
            const d = 'a woman with long red hair, a tattoo and a scarf';
            const { traits, rest } = readTraits(d);
            const f = checkFidelity({ description: d, traits, wardrobe: readWardrobe(rest), params: { hair: 'long', hairColor: traits.hairColor } });
            assert(f.ignored.includes('tattoo') && f.ignored.includes('scarf') && !f.ignored.includes('woman') && !f.ignored.includes('red'), JSON.stringify(f));
            assert(checkFidelity({ description: 'a man in a shirt, jacket and coat', traits: {}, wardrobe: {}, params: {} }).ignored.length === 0, 'singular garments');
            assert(checkFidelity({ description: 'a man', traits: { hair: 'long' }, wardrobe: {}, params: { hair: 'short' } }).conflicts.length === 1, 'override not reported');
          },
        }),
        new SubAgent({
          name: 'pose-planner',
          description: 'idle / walk / run / wave / dance; idle by default so small casts feel alive.',
          run: (input) => planPose(input),
          test: () => {
            assert(planPose({ object: { animation: { type: 'wave' } }, base: {}, count: 1 }).animation.type === 'wave');
            assert(planPose({ object: {}, base: {}, count: 12 }).animation === null, 'crowds stay static (instanced)');
          },
        }),
        new SubAgent({
          name: 'relation-planner',
          description: 'Riders sit in the saddle and move with their mount; companions (dogs…) walk beside their person.',
          run: (objects) => planRelations(objects),
          test: () => {
            const horse = { id: 'h', model: 'quadruped', count: 1, params: { bodyLen: 1.5 }, scale: 1 };
            const dog = { id: 'd', model: 'quadruped', count: 1, params: { bodyLen: 0.7 }, scale: 1 };
            const r = planRelations([{ id: 'k', model: 'human', count: 1, description: 'a knight riding a' }, horse]);
            const c = planRelations([{ id: 'g', model: 'human', count: 1, description: 'a girl walking her' }, dog]);
            assert(r[0]?.kind === 'rider' && r[0].child === 'k' && c[0]?.kind === 'companion' && c[0].child === 'd', JSON.stringify([r, c]));
          },
        }),
        new SubAgent({
          name: 'rig-inspector',
          description: 'Builds the planned character in three.js: feet on ground, height matches plan, every rig mode is finite.',
          run: (input) => (input.params ? inspectRig(input.params, input.style) : inspectRig(input)),
          test: () => {
            const r = inspectRig({ height: 1.8, headUnits: 7.5, outfit: 'armor', hat: 'helmet', prop: 'swordshield' });
            assert(Math.abs(r.minY) < 0.05, `feet at ${r.minY}`);
            assert(Math.abs(r.topY - 1.8) < 0.2, `top at ${r.topY}`);
            assert(r.drawCalls <= 40, `too many draw calls: ${r.drawCalls}`);
          },
        }),
      ],
    });
  }

  /** Plan one human object in place. */
  async plan(o, ctx) {
    const explicit = { ...o.params };
    const { archetype, base } = await this.delegate('archetype-resolver', { params: o.params, description: o.description || '' }, ctx);
    const { traits, rest } = readTraits(o.description || '');
    const wardrobe = readWardrobe(rest);
    const seed = hash(`${o.description || ''}|${o.id}|${archetype}`);
    const crowd = o.count > 1;
    const anatomy = await this.delegate('anatomy-planner', { base, traits, explicit, seed }, ctx);
    const appearance = await this.delegate('appearance-planner', { base, traits, explicit, anatomy, seed, crowd }, ctx);
    const clothes = await this.delegate('wardrobe-planner', { base, wardrobe, explicit, seed, crowd, anatomy }, ctx);
    const pose = await this.delegate('pose-planner', { object: o, base, count: o.count }, ctx);
    o.params = { archetype, ...anatomy, ...appearance, ...clothes, pose: explicit.pose ?? pose.pose, ...(o.count > 12 ? { lod: 'low' } : {}) };
    o.animation = pose.animation;
    o.material = {}; // colours were consumed by the wardrobe; the model owns its materials
    const r = await this.delegate('rig-inspector', { params: o.params, style: o.style }, ctx);
    if (Math.abs(r.minY) > 0.08) ctx.warn(`${o.id}: feet ${r.minY} m off the ground`);
    o.sheet = sheet(o.params, o.animation);
    if (o.description) {
      const f = await this.delegate('description-fidelity', { description: o.description, traits, wardrobe, params: o.params }, ctx);
      o.fidelity = f;
      if (f.ignored.length) ctx.warn(`${o.id}: not modelled from the description: ${f.ignored.slice(0, 8).join(', ')}`);
      for (const c of f.conflicts.slice(0, 3)) ctx.warn(`${o.id}: ${c}`);
    }
    return o;
  }

  async handle(spec, ctx) {
    for (const o of spec.objects) if (o.model === 'human') { o.style = spec.style; await this.plan(o, ctx); }
    return spec;
  }

  /** Runs after the creature agent so mounts/companions have their final proportions. */
  async relate(spec, ctx) {
    const links = await this.delegate('relation-planner', spec.objects, ctx);
    const byId = Object.fromEntries(spec.objects.map((o) => [o.id, o]));
    for (const l of links) {
      const child = byId[l.child], parent = byId[l.parent];
      child.attach = { to: parent.id, kind: l.kind };
      if (l.kind === 'rider') {
        child.params.pose = 'ride';
        parent.params.saddle = true;
        if (child.animation && !['idle', 'wave'].includes(child.animation.type)) child.animation = { ...child.animation, type: 'idle' };
        if (!parent.animation || parent.animation.type === 'idle') {
          const moving = child.description && /\b(galloping|charging|racing|running)\b/.test(child.description) ? 'run' : null;
          if (moving) parent.animation = { type: moving, speed: 1 };
        }
        child.sheet = child.sheet.replace(/pose \w+/, `riding ${parent.params.species ?? parent.model}`);
      } else {
        // companion copies its person's gait, in place (the person's motion carries it)
        const gait = parent.animation?.type === 'run' ? 'run' : parent.animation?.type === 'walk' ? 'walk' : 'idle';
        child.animation = { type: gait, speed: 1 };
        child.sheet = `${child.sheet.replace(/ · \w+$/, '')} · ${gait} beside ${parent.id}`;
      }
      ctx.note(`${child.id} ${l.kind === 'rider' ? 'rides' : 'accompanies'} ${parent.id}`);
    }
    return links;
  }
}
