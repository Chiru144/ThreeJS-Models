// Exporter agent: turns a built model into portable deliverables — real
// AnimationClips baked from the rig, and a .glb usable in Blender / Unity /
// Unreal / any glTF viewer.
import * as THREE from 'three';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { Agent, SubAgent, assert } from '../core/agent.js';
import { buildModel } from '../core/sandbox.js';
import { exportGLB, readGLB } from '../core/gltf.js';

// [mode, loop seconds] per body plan; chosen to match each rig's cycle so loops are seamless
const TAU = Math.PI * 2;
export const CLIPS = {
  human: [['idle', 8], ['walk', TAU / 5.6], ['run', TAU / 9], ['wave', TAU / 1.6], ['dance', TAU / 5 * 2]],
  quadruped: [['idle', 8], ['walk', TAU / 5.2], ['run', TAU / 9], ['fly', TAU / 5]],
  bird: [['idle', 7], ['walk', TAU / 8], ['fly', TAU / 13 * 2]],
  fish: [['idle', TAU / 2.5], ['swim', TAU / 7 * 2]],
  serpent: [['idle', TAU / 0.8], ['slither', TAU / 3]],
  arthropod: [['idle', TAU / 1.3], ['walk', TAU / 10 * 2]],
  blueprint: [['idle', 4]],
};

/** Sample the procedural rig into keyframed AnimationClips (30 fps, seamless loops). */
function bakeClips({ obj, model, fps = 30, only }) {
  const rig = obj.userData.rig;
  if (!rig) return [];
  const bones = []; obj.traverse((o) => { if (o.isBone) bones.push(o); });
  const hasWings = bones.some((b) => /^w[LR]0$/.test(b.name));
  const clips = [];
  for (const [mode, dur] of obj.userData.clips || CLIPS[model] || [['idle', 4]]) {
    if (only && !only.includes(mode)) continue;
    if (mode === 'fly' && model === 'quadruped' && !hasWings) continue;
    const frames = Math.max(8, Math.round(dur * fps)), times = new Float32Array(frames + 1);
    const q = bones.map(() => new Float32Array((frames + 1) * 4)), p = bones.map(() => new Float32Array((frames + 1) * 3));
    for (let f = 0; f <= frames; f++) {
      const t = (f / frames) * dur; times[f] = t;
      rig(t, mode);
      bones.forEach((b, i) => { b.quaternion.toArray(q[i], f * 4); b.position.toArray(p[i], f * 3); });
    }
    // seamless loop: ease the last 15% of the clip back into the first frame
    const blend = Math.max(2, Math.round(frames * 0.15)), qa = new THREE.Quaternion(), qb = new THREE.Quaternion();
    bones.forEach((_, i) => {
      for (let k = 0; k <= blend; k++) {
        const f = frames - blend + k, w = k / blend, s = w * w * (3 - 2 * w);
        qa.fromArray(q[i], f * 4).slerp(qb.fromArray(q[i], 0), s).toArray(q[i], f * 4);
        for (let c = 0; c < 3; c++) p[i][f * 3 + c] += (p[i][c] - p[i][f * 3 + c]) * s;
      }
    });
    const tracks = [];
    bones.forEach((b, i) => {
      const moving = (arr, size) => { for (let f = 1; f <= frames; f++) for (let c = 0; c < size; c++) if (Math.abs(arr[f * size + c] - arr[c]) > 1e-5) return true; return false; };
      if (moving(q[i], 4)) tracks.push(new THREE.QuaternionKeyframeTrack(`${b.name}.quaternion`, times, q[i]));
      if (moving(p[i], 3)) tracks.push(new THREE.VectorKeyframeTrack(`${b.name}.position`, times, p[i]));
    });
    if (tracks.length) clips.push(new THREE.AnimationClip(mode, dur, tracks).optimize());
  }
  rig(0, 'idle');
  return clips;
}

async function writeGLB({ obj, clips = [], file }) {
  const buf = await exportGLB(obj, { animations: clips });
  const json = readGLB(buf);
  if (file) { await mkdir(path.dirname(file), { recursive: true }); await writeFile(file, buf); }
  return {
    file, bytes: buf.length, buffer: buf,
    summary: { meshes: json.meshes?.length || 0, materials: json.materials?.length || 0, skins: json.skins?.length || 0, joints: json.skins?.[0]?.joints.length || 0, animations: (json.animations || []).map((a) => a.name), textures: json.images?.length || 0, extensions: json.extensionsUsed || [] },
  };
}

export class ExporterAgent extends Agent {
  constructor() {
    super({
      name: 'exporter',
      role: 'Bakes rigs into AnimationClips and writes .glb files for Blender, Unity, Unreal and glTF viewers.',
      subagents: [
        new SubAgent({
          name: 'clip-baker',
          description: 'Samples each rig mode into seamless, optimised keyframe clips (idle, walk, run, fly, swim…).',
          run: (input) => bakeClips(input),
          test: () => {
            const { obj } = buildModel('fish', { length: 0.4 });
            const clips = bakeClips({ obj, model: 'fish' });
            assert(clips.length === 2 && clips[1].name === 'swim' && clips[1].tracks.length >= 3, clips.map((c) => `${c.name}:${c.tracks.length}`).join(','));
            const tr = clips[1].tracks[0], n = tr.times.length;
            for (let c = 0; c < 4; c++) assert(Math.abs(tr.values[c] - tr.values[(n - 1) * 4 + c]) < 1e-4, 'loop must close');
          },
        }),
        new SubAgent({
          name: 'glb-writer',
          description: 'glTF 2.0 binary with skins, vertex colours, PBR extensions (clearcoat, sheen…), textures and animations.',
          run: (input) => writeGLB(input),
          test: async () => {
            const { obj } = buildModel('fish', { length: 0.4 });
            const r = await writeGLB({ obj, clips: bakeClips({ obj, model: 'fish' }) });
            assert(r.bytes > 10000 && r.summary.skins >= 1 && r.summary.animations.includes('swim') && r.summary.textures >= 1, JSON.stringify(r.summary));
          },
        }),
      ],
    });
  }

  /** Bake + export one built model. */
  async exportModel({ obj, model, file }, ctx) {
    const clips = await this.delegate('clip-baker', { obj, model }, ctx);
    return this.delegate('glb-writer', { obj, clips, file }, ctx);
  }
}
