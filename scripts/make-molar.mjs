/**
 * Builds public/models/molar.glb: an anatomical lower first molar (five cusps,
 * two curved roots joined by a root trunk), made from smooth shapes blended
 * together, then meshed, smoothed and saved as a glTF binary.
 *
 *   node scripts/make-molar.mjs
 *
 * The file has two meshes, "crown" (enamel) and "roots", so the website can
 * light the roots up and fit the clear aligner over the crown only.
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const RES = Number(process.env.RES || 120);

/* ---------------------------------------------------------------- shapes */
const len = (x, y, z) => Math.hypot(x, y, z);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
// smooth union / smooth subtraction (polynomial)
const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
const ssub = (d, cut, k) => -smin(-d, cut, k);
function roundBox(px, py, pz, bx, by, bz, r) {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
  return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
function ellipsoid(px, py, pz, rx, ry, rz) {           // good-enough distance to an ellipsoid
  const k0 = len(px / rx, py / ry, pz / rz), k1 = len(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k0 * (k0 - 1) / (k1 || 1e-6);
}
function capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}
/** a root: tapers from r0 at the top to r1 at the tip, flattened mesio-distally, curving distally (+x) */
function root(px, py, pz, x0, x1, top, tip, r0, r1, flat, bend) {
  const t = clamp((top - py) / (top - tip), 0, 1);
  const cx = x0 + (x1 - x0) * t + bend * t * t;
  const r = r0 + (r1 - r0) * Math.pow(t, 0.9);
  let d = (Math.hypot((px - cx) / flat, pz) - r) * flat;     // elliptical cross-section
  if (py < tip) d = len((px - (x1 + bend)) / flat, (py - tip) / 0.8, pz) * flat - r1 * flat;   // rounded apex
  if (py > top) d = Math.max(d, py - top);
  return d;
}

const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/** a rounded "superellipsoid": a box with fully convex sides (p = 2 is an ellipsoid, higher is boxier) */
function superEllipsoid(px, py, pz, a, b, c, p) {
  const k = Math.pow(Math.pow(Math.abs(px / a), p) + Math.pow(Math.abs(py / b), p) + Math.pow(Math.abs(pz / c), p), 1 / p);
  return (k - 1) * Math.min(a, b, c);
}

function sdf(x, y, z) {
  // crown: convex all round, widest at mid-height, slightly narrower at the chewing surface
  const s = 1 - 0.06 * smooth01(0.55, 1.0, y);
  let d = superEllipsoid(x / s, y - 0.5, z / s, 1.04, 0.52, 0.88, 2.7);
  // five low, rounded cusps: three buccal (z > 0), two lingual (a little taller)
  const cusps = [[-0.56, 0.8, 0.4, 0.4], [0.04, 0.82, 0.46, 0.38], [0.6, 0.77, 0.36, 0.34], [-0.4, 0.86, -0.38, 0.42], [0.44, 0.85, -0.38, 0.4]];
  for (const [cx, cy, cz, r] of cusps) d = smin(d, ellipsoid(x - cx, y - cy, z - cz, r, r * 0.6, r), 0.3);
  // shallow fissures: the central groove, two buccal grooves and one lingual
  d = ssub(d, capsule(x, y, z, -0.8, 1.07, 0.03, 0.8, 1.07, -0.03, 0.09), 0.12);
  d = ssub(d, capsule(x, y, z, -0.26, 1.07, 0.0, -0.32, 1.02, 0.8, 0.06), 0.1);   // buccal grooves, between the three buccal cusps
  d = ssub(d, capsule(x, y, z, 0.32, 1.07, 0.0, 0.36, 1.0, 0.8, 0.06), 0.1);
  d = ssub(d, capsule(x, y, z, 0.02, 1.07, 0.0, 0.02, 1.03, -0.8, 0.06), 0.1);     // lingual groove
  // the neck, blending smoothly into the root trunk
  const trunk = superEllipsoid(x, y + 0.25, z, 0.74, 0.42, 0.62, 2.6);
  d = smin(d, trunk, 0.42);
  // two broad roots, mesial and distal, curving slightly distally (+x)
  const mesial = root(x, y, z, -0.42, -0.5, -0.25, -2.0, 0.54, 0.16, 0.66, 0.2);
  const distal = root(x, y, z, 0.44, 0.52, -0.25, -1.88, 0.5, 0.16, 0.64, 0.16);
  d = smin(d, smin(mesial, distal, 0.1), 0.34);
  return d;
}

/* ---------------------------------------------------------------- mesh */
const CENTER = new THREE.Vector3(0, -0.4, 0), HALF = 1.75;
const mc = new MarchingCubes(RES, new THREE.MeshBasicMaterial(), false, false, 900000);
mc.isolation = 0;
for (let k = 0; k < RES; k++) for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) {
  const x = ((i - RES / 2) / (RES / 2)) * HALF + CENTER.x;
  const y = ((j - RES / 2) / (RES / 2)) * HALF + CENTER.y;
  const z = ((k - RES / 2) / (RES / 2)) * HALF + CENTER.z;
  mc.field[i + j * RES + k * RES * RES] = -sdf(x, y, z);
}
mc.update();
const n = mc.count;
const raw = new THREE.BufferGeometry();
const pos = new Float32Array(n * 3);
for (let i = 0; i < n * 3; i += 3) {
  pos[i] = mc.positionArray[i] * HALF + CENTER.x;
  pos[i + 1] = mc.positionArray[i + 1] * HALF + CENTER.y;
  pos[i + 2] = mc.positionArray[i + 2] * HALF + CENTER.z;
}
raw.setAttribute('position', new THREE.BufferAttribute(pos, 3));
let g = mergeVertices(raw, 1e-5);

// Taubin smoothing (keeps the volume): removes the marching-cubes stepping
function smooth(geom, iters) {
  const p = geom.attributes.position.array, idx = geom.index.array, nv = p.length / 3;
  const nb = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) { const [a, b, c] = [idx[t], idx[t + 1], idx[t + 2]]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const lists = nb.map(s => [...s]);
  const tmp = new Float32Array(p.length);
  const step = f => {
    for (let v = 0; v < nv; v++) {
      const L = lists[v]; if (!L.length) { tmp.set(p.subarray(v * 3, v * 3 + 3), v * 3); continue; }
      let sx = 0, sy = 0, sz = 0; for (const u of L) { sx += p[u * 3]; sy += p[u * 3 + 1]; sz += p[u * 3 + 2]; }
      const m = L.length;
      tmp[v * 3] = p[v * 3] + f * (sx / m - p[v * 3]); tmp[v * 3 + 1] = p[v * 3 + 1] + f * (sy / m - p[v * 3 + 1]); tmp[v * 3 + 2] = p[v * 3 + 2] + f * (sz / m - p[v * 3 + 2]);
    }
    p.set(tmp);
  };
  for (let i = 0; i < iters; i++) { step(0.5); step(-0.53); }
}
smooth(g, 8);
g.computeVertexNormals();

// split into crown and roots along a gently wavy cemento-enamel junction
const cej = (x, z) => 0.0 + 0.08 * Math.cos(Math.atan2(z, x) * 2);
function part(geom, keep) {
  const p = geom.attributes.position.array, nrm = geom.attributes.normal.array, idx = geom.index.array;
  const map = new Map(), P = [], N = [], I = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3, cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
    if (keep(cy > cej(cx, cz))) for (const v of [a, b, c]) {
      if (!map.has(v)) { map.set(v, P.length / 3); P.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); }
      I.push(map.get(v));
    }
  }
  return { P: new Float32Array(P), N: new Float32Array(N), I: P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I) };
}
const crown = part(g, up => up), roots = part(g, up => !up);

/* ---------------------------------------------------------------- GLB */
function glb(meshes) {
  const chunks = [], views = [], accessors = [], gltfMeshes = [], nodes = [];
  let offset = 0;
  const add = (arr, target) => { const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad)); views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, target }); offset += buf.length + pad; return views.length - 1; };
  meshes.forEach(({ name, P, N, I }, i) => {
    let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (let k = 0; k < P.length; k += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], P[k + a]); max[a] = Math.max(max[a], P[k + a]); }
    const pv = add(P, 34962), nv = add(N, 34962), iv = add(I, 34963);
    accessors.push({ bufferView: pv, componentType: 5126, count: P.length / 3, type: 'VEC3', min, max });
    accessors.push({ bufferView: nv, componentType: 5126, count: N.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: iv, componentType: I instanceof Uint32Array ? 5125 : 5123, count: I.length, type: 'SCALAR' });
    gltfMeshes.push({ name, primitives: [{ attributes: { POSITION: i * 3, NORMAL: i * 3 + 1 }, indices: i * 3 + 2, material: i }] });
    nodes.push({ name, mesh: i });
  });
  const json = {
    asset: { version: '2.0', generator: 'DentalFlow make-molar' },
    scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes, meshes: gltfMeshes,
    materials: [{ name: 'enamel', pbrMetallicRoughness: { baseColorFactor: [0.96, 0.94, 0.9, 1], metallicFactor: 0, roughnessFactor: 0.3 } },
                { name: 'root', pbrMetallicRoughness: { baseColorFactor: [0.93, 0.88, 0.78, 1], metallicFactor: 0, roughnessFactor: 0.5 } }],
    accessors, bufferViews: views, buffers: [{ byteLength: offset }],
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, js, bh, bin]);
}
const out = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'models', 'molar.glb');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, glb([{ name: 'crown', ...crown }, { name: 'roots', ...roots }]));
console.log(`molar.glb: ${(fs.statSync(out).size / 1024).toFixed(0)} KB, crown ${crown.I.length / 3} + roots ${roots.I.length / 3} triangles`);
