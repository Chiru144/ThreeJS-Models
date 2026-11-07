// Builds library models with the real three.js in Node (no WebGL needed) so
// agents can measure actual triangle / draw-call costs and tests can run them.
import * as THREE from 'three';
import { MODELS } from '../library/models.js';
import * as H from '../library/helpers.js';

const HELPERS = [H.rng, H.heightAt, H.scatter, H.instanceize, H.mergeParts].map((f) => f.toString()).join('\n');

export function makeMaterialCache() {
  const mats = new Map();
  const M = (key, props, type = 'MeshStandardMaterial') => {
    if (!mats.has(key)) mats.set(key, new THREE[type](props));
    return mats.get(key);
  };
  return { M, mats };
}

export function buildModel(name, params = {}, terrain = { amp: 0, flats: [] }) {
  const def = MODELS[name];
  if (!def) throw new Error(`unknown model ${name}`);
  // eslint-disable-next-line no-new-func
  const factory = new Function('THREE', 'TERRAIN', `${HELPERS}\nreturn (${def.fn.toString()});`)(THREE, terrain);
  const { M, mats } = makeMaterialCache();
  const obj = factory(THREE, M, params, undefined);
  return { obj, mats };
}

export function measure(root) {
  let triangles = 0, drawCalls = 0, meshes = 0, instances = 0, points = 0, lights = 0, shadowLights = 0;
  const materials = new Set(), geometries = new Set();
  let finite = true;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const e = o.matrixWorld.elements;
    for (let i = 0; i < 16; i++) if (!Number.isFinite(e[i])) finite = false;
    if (o.isLight) { lights++; if (o.castShadow) shadowLights++; }
    if (o.isPoints) { points += o.geometry.attributes.position.count; drawCalls++; geometries.add(o.geometry); materials.add(o.material); }
    if (!o.isMesh) return;
    meshes++;
    const g = o.geometry;
    geometries.add(g);
    [].concat(o.material).forEach((m) => materials.add(m));
    const n = o.isInstancedMesh ? o.count : 1;
    instances += n;
    const tri = (g.index ? g.index.count : g.attributes.position.count) / 3;
    triangles += tri * n;
    drawCalls += Array.isArray(o.material) ? o.material.length : 1;
  });
  return { triangles: Math.round(triangles), drawCalls, meshes, instances, points, lights, shadowLights, materials: materials.size, geometries: geometries.size, finite };
}

export { THREE };
