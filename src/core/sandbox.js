// Builds library models with the real three.js in Node (no WebGL needed) so
// agents can measure actual triangle / draw-call costs and tests can run them.
import * as THREE from 'three';
import { MODELS } from '../library/models.js';
import * as H from '../library/helpers.js';
import { BLUEPRINT_LIBRARY, expandBlueprint } from '../library/blueprint.js';

const HELPERS = [H.rng, H.heightAt, H.scatter, H.instanceize, H.mergeParts, H.sculpt, H.rigKit, H.surfaceTex, H.grassField, H.detailize, H.furShells].map((f) => f.toString()).join('\n');

export function makeMaterialCache() {
  const mats = new Map();
  const M = (key, props, type = 'MeshStandardMaterial') => {
    if (!mats.has(key)) mats.set(key, new THREE[type](props));
    return mats.get(key);
  };
  return { M, mats };
}

const factories = new Map();
export function buildModel(name, params = {}, terrain = { amp: 0, flats: [] }, style = 'realistic') {
  const def = MODELS[name];
  if (!def) throw new Error(`unknown model ${name}`);
  const fn = style === 'stylized' && def.stylizedFn ? def.stylizedFn : def.fn;
  const key = `${name}|${style}|${JSON.stringify(terrain)}`;
  // eslint-disable-next-line no-new-func
  if (!factories.has(key)) factories.set(key, new Function('THREE', 'TERRAIN', `${HELPERS}\nreturn (${fn.toString()});`)(THREE, terrain));
  const factory = factories.get(key);
  // library models sculpt from a compiled blueprint; compile the default one when the caller gave none
  if (fn === def.fn && def.library && !params.bp) params = { ...params, bp: expandBlueprint(BLUEPRINT_LIBRARY[def.library](params)).bp };
  const { M, mats } = makeMaterialCache();
  const obj = factory(THREE, M, params, undefined);
  return { obj, mats };
}

export function measure(root) {
  let triangles = 0, drawCalls = 0, meshes = 0, instances = 0, points = 0, lights = 0, shadowLights = 0, shellTris = 0;
  const materials = new Set(), geometries = new Set();
  let finite = true;
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const e = o.matrixWorld.elements;
    for (let i = 0; i < 16; i++) if (!Number.isFinite(e[i])) finite = false;
    if (o.isLight) { lights++; if (o.castShadow) shadowLights++; }
    if (o.isPoints) { points += o.geometry.attributes.position.count; drawCalls++; geometries.add(o.geometry); materials.add(o.material); }
    if (!o.isMesh) return;
    if (o.userData.shell) { shellTris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; drawCalls++; return; }
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
  return { triangles: Math.round(triangles + shellTris), drawCalls, meshes, instances, points, lights, shadowLights, materials: materials.size, geometries: geometries.size, finite };
}

export { THREE };
