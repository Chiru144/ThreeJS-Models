import { Agent, SubAgent, assert } from '../core/agent.js';
import { MODELS, sizeOf } from '../library/models.js';
import { ANIMATIONS } from '../library/presets.js';

const r2 = (n) => Math.round(n * 100) / 100;

/** Decide where everything goes. Heroes in a row at the centre, groups scattered around. */
function planLayout(spec) {
  const space = spec.environment.ground === 'none';
  const items = [];
  // Hero row: single objects and small groups (≤3) of non-natural models, centred.
  const cast = (o) => o.kind === 'character' || o.kind === 'creature';
  const isHero = (o) => !o.attach && !o.position && o.count <= 3 && (cast(o) || !(o.count > 1 && MODELS[o.model].natural)) && ['primitive', 'procedural', 'parametric', 'character', 'creature'].includes(o.kind);
  const heroes = spec.objects.filter(isHero);
  const gap = 1.2;
  const spread = space ? 2.5 : 1;
  const width = heroes.reduce((s, o) => s + (sizeOf(o).footprint * 2 * spread + gap) * o.count, -gap);
  let x = -width / 2;
  let heroExtent = 0, heroHeight = 0;
  const occupied = [];
  for (const o of heroes) {
    const fp = sizeOf(o).footprint * spread;
    const positions = [];
    for (let i = 0; i < o.count; i++) {
      x += fp;
      positions.push([r2(x), 0, 0]);
      occupied.push([r2(x), 0, r2(fp + 0.4)]);
      heroExtent = Math.max(heroExtent, Math.abs(x) + fp);
      x += fp + gap;
    }
    heroHeight = Math.max(heroHeight, sizeOf(o).height);
    // moving heroes loop around the centre: keep their whole path in frame
    if (ANIMATIONS[o.animation?.type]?.locomotion) {
      const R = Math.max(...positions.map((q) => Math.abs(q[0])), fp * 2.5, 1.2);
      heroExtent = Math.max(heroExtent, R + fp);
      if (o.animation.type === 'fly') heroHeight = Math.max(heroHeight, Math.max(1.2, fp * 3) + sizeOf(o).height);
    }
    items.push({ id: o.id, mode: 'row', positions });
  }
  for (const o of spec.objects.filter((o) => o.attach)) items.push({ id: o.id, mode: 'attached' });
  for (const o of spec.objects.filter((o) => o.position && !o.attach)) {
    items.push({ id: o.id, mode: 'row', positions: [o.position] });
    occupied.push([o.position[0], o.position[2], sizeOf(o).footprint + 0.4]);
    heroExtent = Math.max(heroExtent, Math.hypot(o.position[0], o.position[2]) + sizeOf(o).footprint);
    heroHeight = Math.max(heroHeight, sizeOf(o).height + Math.max(0, o.position[1]));
  }
  if (heroExtent === 0) heroExtent = 1;

  let water = null;
  const w = spec.objects.find((o) => o.model === 'water');
  if (w) {
    const R = (w.params.size ?? 20) / 2;
    water = { id: w.id, position: [0, 0, r2(-(heroExtent + R + 1))] };
    occupied.push([0, water.position[2], R + 0.5]);
    items.push({ id: w.id, mode: 'row', positions: [water.position] });
  }

  const inner = heroExtent + 1.5;
  let area = 0, extent = Math.max(heroExtent, water ? -water.position[2] + (w.params.size ?? 20) / 2 : 0);
  spec.objects.forEach((o, idx) => {
    if (o.count < 2 || isHero(o) || o.attach) return;
    const fp = sizeOf(o).footprint;
    const minDist = r2(Math.max(0.5, fp * 1.6));
    area += o.count * (minDist * 1.25) ** 2 * Math.PI;
    const outer = r2(Math.sqrt(inner * inner + area / Math.PI) * 1.15 + fp);
    items.push({
      id: o.id, mode: 'scatter',
      scatter: { count: o.count, inner: r2(inner), outer, minDist, seed: spec.seed + idx * 7919, yJitter: space ? r2(outer * 0.25) : 0 },
    });
    extent = Math.max(extent, outer);
  });
  for (const o of spec.objects) if (o.model === 'stars' || o.model === 'terrain' || o.model === 'ground') items.push({ id: o.id, mode: o.model === 'stars' ? 'backdrop' : 'surface' });
  return {
    items, occupied, extent: r2(extent), heroExtent: r2(heroExtent), heroHeight: r2(heroHeight || 1), space,
    water: water && { center: [water.position[0], water.position[2]], radius: (w.params.size ?? 20) / 2 },
  };
}

function planEnvironment(spec, layout) {
  const terrainObj = spec.objects.find((o) => o.model === 'terrain');
  // Ground reaches past the fog's far plane (2 triangles, so size is free) to hide its edge.
  const size = Math.ceil(Math.max(200, layout.extent * 12 + 100));
  if (terrainObj) terrainObj.params.size = Math.max(terrainObj.params.size ?? 0, Math.ceil(Math.max(80, layout.extent * 3 + 30)));
  return {
    groundSize: size,
    autoGround: !layout.space && !terrainObj && !spec.objects.some((o) => o.model === 'ground') && spec.environment.ground !== 'none',
    terrain: {
      amp: terrainObj ? terrainObj.params.amp ?? 1.5 : 0,
      flats: terrainObj ? [[0, 0, r2(layout.heroExtent + 1.5), 0], ...(layout.water ? [[...layout.water.center, r2(layout.water.radius + 0.5), 0.5]] : [])] : [],
    },
  };
}

function frameCamera(layout) {
  const fov = 50;
  // frame the hero row tightly; only pull back for scattered surroundings when there is no hero
  const subject = Math.max(layout.heroExtent * 1.15, layout.heroHeight * 0.8, Math.min(layout.extent * (layout.heroExtent > 1 ? 0.45 : 0.3), 30), 0.25);
  const d = Math.max(subject / Math.tan((fov * Math.PI) / 360), 0.8);
  const target = [0, r2(layout.heroHeight * (layout.space ? 0.5 : 0.45)), 0];
  return {
    fov,
    position: [r2(d * 0.62), r2(target[1] + d * 0.3), r2(d * 0.78)],
    target,
    near: Math.min(0.1, r2(d * 0.02) || 0.01),
    far: Math.ceil(Math.max(1000, layout.extent * 20)),
    maxDistance: Math.ceil(Math.max(d * 3, layout.extent * 2)),
    maxPolar: layout.space ? Math.PI : r2(Math.PI * 0.49),
  };
}

export class ComposerAgent extends Agent {
  constructor() {
    super({
      name: 'composer',
      role: 'Lays out the scene, builds the environment and frames the camera.',
      subagents: [
        new SubAgent({
          name: 'layout-planner',
          description: 'Hero objects in a centred row; groups scattered in collision-free rings.',
          run: (spec) => planLayout(spec),
          test: () => {
            const L = planLayout({ seed: 1, environment: { ground: 'grass' }, objects: [
              { id: 'a', model: 'house', kind: 'procedural', count: 1, scale: 1 },
              { id: 'b', model: 'tree', kind: 'procedural', count: 20, scale: 1 }] });
            assert(L.items.find((i) => i.id === 'a').mode === 'row', 'hero');
            const s = L.items.find((i) => i.id === 'b').scatter;
            assert(s.inner > L.heroExtent && s.outer > s.inner, 'scatter ring');
          },
        }),
        new SubAgent({
          name: 'environment-builder',
          description: 'Ground size, terrain height-field settings, auto ground plane.',
          run: ({ spec, layout }) => planEnvironment(spec, layout),
          test: () => {
            const e = planEnvironment({ environment: { ground: 'grass' }, objects: [] }, { extent: 10, heroExtent: 2, space: false });
            assert(e.autoGround && e.groundSize >= 60 && e.terrain.amp === 0, 'env');
          },
        }),
        new SubAgent({
          name: 'camera-framer',
          description: 'Places a perspective camera + orbit limits that frame the subject.',
          run: (layout) => frameCamera(layout),
          test: () => {
            const c = frameCamera({ heroExtent: 2, heroHeight: 2, extent: 20, space: false });
            assert(c.position.every(Number.isFinite) && c.position[2] > 3 && c.maxDistance > c.position[2], 'camera');
          },
        }),
      ],
    });
  }

  async handle(spec, ctx) {
    const layout = await this.delegate('layout-planner', spec, ctx);
    const env = await this.delegate('environment-builder', { spec, layout }, ctx);
    const camera = await this.delegate('camera-framer', layout, ctx);
    // keep scattered props off the camera and out of its line of sight to the heroes
    const [cx, , cz] = camera.position;
    const dist = Math.hypot(cx, cz);
    for (const k of [1, 0.7, 0.45]) {
      const r = Math.max(1, dist * 0.18 * k + (k === 1 ? 1 : 0));
      if (dist * k > layout.heroExtent + r * 0.5) layout.occupied.push([r2(cx * k), r2(cz * k), r2(r)]);
    }
    return { layout, env, camera };
  }
}
