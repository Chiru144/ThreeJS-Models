import { Agent, SubAgent, assert } from '../core/agent.js';
import { LIGHTING, QUALITY } from '../library/presets.js';

const r2 = (n) => Math.round(n * 100) / 100;

function selectRig({ preset }) {
  const rig = LIGHTING[preset] || LIGHTING.studio;
  return { preset: LIGHTING[preset] ? preset : 'studio', ...rig };
}

function configureShadows({ rig, extent, quality, shadows }) {
  const q = QUALITY[quality];
  const enabled = Boolean(shadows) && q.shadows !== false;
  const half = r2(Math.min(Math.max(extent * 1.1, 6), 120));
  const lights = rig.lights.map((l) => {
    if (l.type !== 'DirectionalLight') return { ...l };
    const len = Math.hypot(...l.dir);
    const dist = Math.max(half * 2, 20);
    return {
      ...l,
      pos: l.dir.map((d) => r2((d / len) * dist)),
      shadow: enabled && l.shadow ? { mapSize: q.shadowMapSize, half, far: r2(dist * 2.5), bias: -0.0004, normalBias: 0.02 } : null,
    };
  });
  return { enabled: enabled && lights.some((l) => l.shadow), lights };
}

export class LightingAgent extends Agent {
  constructor() {
    super({
      name: 'lighting',
      role: 'Chooses a lighting rig and fits shadow cameras to the scene.',
      subagents: [
        new SubAgent({
          name: 'rig-selector',
          description: 'studio · daylight · sunset · night · space · neon rigs with matching sky/fog/exposure.',
          run: (input) => selectRig(input),
          test: () => assert(selectRig({ preset: 'night' }).background === LIGHTING.night.background && selectRig({ preset: 'x' }).preset === 'studio'),
        }),
        new SubAgent({
          name: 'shadow-configurator',
          description: 'Tight shadow frustum + map size from quality; one shadow caster only.',
          run: (input) => configureShadows(input),
          test: () => {
            const s = configureShadows({ rig: LIGHTING.daylight, extent: 30, quality: 'medium', shadows: true });
            assert(s.enabled && s.lights[0].shadow.half >= 30 && s.lights[0].shadow.mapSize === 2048, 'shadow fit');
            assert(!configureShadows({ rig: LIGHTING.daylight, extent: 30, quality: 'low', shadows: true }).enabled, 'low = off');
          },
        }),
      ],
    });
  }

  async handle({ spec, extent }, ctx) {
    const rig = await this.delegate('rig-selector', spec.lighting, ctx);
    const shadows = await this.delegate('shadow-configurator', { rig, extent, quality: spec.quality, shadows: spec.lighting.shadows }, ctx);
    return { rig, ...shadows };
  }
}
