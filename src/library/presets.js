// Lighting rigs, animation types and quality budgets.

export const LIGHTING = {
  studio: {
    background: 0x1e1f24, fog: 0x1e1f24, exposure: 1, envIntensity: 0.8,
    hemi: [0xffffff, 0x3a3a44, 0.5],
    lights: [
      { type: 'DirectionalLight', color: 0xffffff, intensity: 2.2, dir: [0.5, 0.8, 0.5], shadow: true },
      { type: 'DirectionalLight', color: 0xbfd4ff, intensity: 0.6, dir: [-0.6, 0.3, -0.2] },
      { type: 'DirectionalLight', color: 0xffffff, intensity: 0.9, dir: [0, 0.4, -1] },
    ],
    words: ['studio', 'product', 'showcase', 'turntable', 'render'],
  },
  daylight: {
    background: 0x9fd3ff, fog: 0x9fd3ff, exposure: 1, envIntensity: 0.5,
    hemi: [0xbfe3ff, 0x5a7a3a, 0.9],
    lights: [{ type: 'DirectionalLight', color: 0xfff4e0, intensity: 2.6, dir: [0.5, 0.8, 0.3], shadow: true }],
    words: ['day', 'daylight', 'sunny', 'noon', 'morning', 'bright'],
  },
  sunset: {
    background: 0xf2a65a, fog: 0xe89a5c, exposure: 1.05, envIntensity: 0.4,
    hemi: [0xffc49b, 0x3a2a4a, 0.6],
    lights: [{ type: 'DirectionalLight', color: 0xff9a4d, intensity: 2.8, dir: [-0.9, 0.25, -0.2], shadow: true }],
    words: ['sunset', 'dusk', 'dawn', 'golden hour', 'sunrise', 'evening'],
  },
  night: {
    background: 0x0b1026, fog: 0x0b1026, exposure: 1.1, envIntensity: 0.15,
    hemi: [0x334477, 0x080810, 0.4],
    lights: [{ type: 'DirectionalLight', color: 0x9db4ff, intensity: 0.8, dir: [-0.4, 0.8, 0.2], shadow: true }],
    words: ['night', 'nighttime', 'moonlight', 'moonlit', 'midnight', 'dark'],
  },
  space: {
    background: 0x000005, fog: null, exposure: 1, envIntensity: 0.1,
    hemi: [0x222233, 0x000000, 0.25],
    lights: [{ type: 'DirectionalLight', color: 0xffffff, intensity: 3, dir: [0.8, 0.3, 0.5], shadow: true }],
    words: ['space', 'galaxy', 'cosmos', 'cosmic', 'solar system', 'outer space', 'orbit'],
  },
  neon: {
    background: 0x0a0014, fog: 0x0a0014, exposure: 1.1, envIntensity: 0.2,
    hemi: [0x5522aa, 0x05000a, 0.4],
    lights: [
      { type: 'PointLight', color: 0xff2bd6, intensity: 60, pos: [-6, 5, 4], distance: 40 },
      { type: 'PointLight', color: 0x22e5ff, intensity: 60, pos: [6, 5, -4], distance: 40 },
      { type: 'DirectionalLight', color: 0x8866ff, intensity: 0.6, dir: [0.2, 1, 0.3], shadow: true },
    ],
    words: ['neon', 'cyberpunk', 'synthwave', 'vaporwave', 'retro'],
  },
  underwater: {
    background: 0x0b4f6c, fog: 0x0b4f6c, exposure: 1.05, envIntensity: 0.3,
    hemi: [0x6fc3df, 0x0a2a3a, 0.9],
    lights: [{ type: 'DirectionalLight', color: 0xbfefff, intensity: 1.8, dir: [0.2, 1, 0.15], shadow: true }],
    words: ['underwater', 'under water', 'aquarium', 'seabed', 'ocean floor', 'reef', 'coral', 'deep sea', 'undersea'],
  },
};

export const ANIMATIONS = {
  rotate: { speed: 0.6, words: ['rotating', 'rotate', 'spinning', 'spin', 'turning', 'turntable', 'revolving'] },
  float: { speed: 1.5, amp: 0.3, words: ['floating', 'float', 'hovering', 'hover', 'bobbing', 'levitating'] },
  orbit: { speed: 0.3, words: ['orbiting', 'circling'] },
  pulse: { speed: 2, amp: 0.08, words: ['pulsing', 'pulse', 'breathing', 'throbbing'] },
  sway: { speed: 1.2, amp: 0.08, words: ['swaying', 'sway', 'wobbling', 'rocking'] },
  bounce: { speed: 3, amp: 0.6, words: ['bouncing', 'bounce', 'jumping', 'hopping'] },
  // rig-driven (characters & creatures): limbs animate, locomotion moves along a loop
  idle: { speed: 1, rig: true, words: ['idle', 'standing', 'resting', 'breathing', 'grazing', 'sitting'] },
  walk: { speed: 1, rig: true, locomotion: 1.2, words: ['walking', 'walk', 'strolling', 'wandering', 'marching', 'patrolling', 'waddling', 'roaming', 'crawling'] },
  run: { speed: 1, rig: true, locomotion: 3.2, words: ['running', 'run', 'jogging', 'sprinting', 'galloping', 'racing', 'charging', 'chasing'] },
  wave: { speed: 1, rig: true, words: ['waving', 'wave', 'greeting'] },
  dance: { speed: 1, rig: true, words: ['dancing', 'dance', 'partying'] },
  fly: { speed: 1, rig: true, locomotion: 4, words: ['flying', 'fly', 'soaring', 'gliding'] },
  swim: { speed: 1, rig: true, locomotion: 1, words: ['swimming', 'swim', 'diving'] },
  slither: { speed: 1, rig: true, locomotion: 0.6, words: ['slithering', 'slither', 'snaking'] },
};

export const QUALITY = {
  low: { pixelRatioCap: 1, antialias: false, shadowMapSize: 1024, shadows: false, triBudget: 500_000, drawBudget: 100, instanceThreshold: 3 },
  medium: { pixelRatioCap: 1.5, antialias: true, shadowMapSize: 2048, shadows: true, triBudget: 2_500_000, drawBudget: 300, instanceThreshold: 4 },
  high: { pixelRatioCap: 2, antialias: true, shadowMapSize: 4096, shadows: true, triBudget: 8_000_000, drawBudget: 800, instanceThreshold: 6 },
};

export const THREE_VERSION = '0.187.0';
