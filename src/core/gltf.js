// GLB export in Node: three's GLTFExporter + minimal browser shims
// (FileReader, a canvas that only needs to hold RGBA pixels and encode PNG).
import zlib from 'node:zlib';
import * as THREE from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

const crcTable = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

/** Encode RGBA8 pixels as a PNG (no dependencies). */
export function encodePNG(rgba, width, height) {
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) { raw[y * (width * 4 + 1)] = 0; Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1); }
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 6 })), chunk('IEND', Buffer.alloc(0))]);
}

class NodeImageData { constructor(data, width, height) { this.data = data; this.width = width; this.height = height; } }
class NodeCanvas {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this._px = null; this._flip = false; }
  getContext() {
    const self = this;
    return {
      translate() {}, scale(_x, y) { if (y < 0) self._flip = true; },
      putImageData(img) { self._px = img.data; self.width = img.width; self.height = img.height; },
      drawImage(img) { if (img._px) { self._px = img._px; self.width = img.width; self.height = img.height; } },
      getImageData() { return new NodeImageData(self._px ?? new Uint8ClampedArray(self.width * self.height * 4), self.width, self.height); },
    };
  }
  convertToBlob() {
    let px = this._px ?? new Uint8ClampedArray(this.width * this.height * 4);
    if (this._flip) { const out = new Uint8ClampedArray(px.length), row = this.width * 4; for (let y = 0; y < this.height; y++) out.set(px.subarray(y * row, (y + 1) * row), (this.height - 1 - y) * row); px = out; }
    return Promise.resolve(new Blob([encodePNG(px, this.width, this.height)], { type: 'image/png' }));
  }
}
class NodeFileReader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); }); }
  readAsDataURL(blob) { blob.arrayBuffer().then((b) => { this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(b).toString('base64')}`; this.onloadend?.(); }); }
}

/** Export an Object3D (+ optional AnimationClips) to a GLB Buffer. */
export async function exportGLB(object, { animations = [] } = {}) {
  const saved = { FileReader: globalThis.FileReader, OffscreenCanvas: globalThis.OffscreenCanvas, ImageData: globalThis.ImageData };
  globalThis.FileReader = NodeFileReader; globalThis.OffscreenCanvas = NodeCanvas; globalThis.ImageData = NodeImageData;
  // the exporter reports unsupported features (e.g. hemisphere lights) on the console; keep stdio clean for MCP
  const con = { warn: console.warn, log: console.log, error: console.error };
  console.warn = console.log = console.error = () => {};
  try {
    object.updateMatrixWorld(true);
    const exporter = new GLTFExporter();
    const buf = await new Promise((resolve, reject) => exporter.parse(object, resolve, reject, { binary: true, animations, onlyVisible: true }));
    return Buffer.from(buf);
  } finally {
    Object.assign(console, con);
    for (const [k, v] of Object.entries(saved)) { if (v === undefined) delete globalThis[k]; else globalThis[k] = v; }
  }
}

/** Read back the JSON chunk of a GLB (for summaries and tests). */
export function readGLB(buf) {
  if (buf.readUInt32LE(0) !== 0x46546c67) throw new Error('not a GLB');
  const jsonLen = buf.readUInt32LE(12);
  return JSON.parse(buf.subarray(20, 20 + jsonLen).toString('utf8'));
}

export { THREE };
