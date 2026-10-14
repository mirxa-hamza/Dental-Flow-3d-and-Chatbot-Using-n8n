/** Shared tools for the model scripts: smooth shapes (signed distances), meshing, smoothing, and a small glTF writer. */
import * as THREE from 'three';
import { MarchingCubes } from 'three/examples/jsm/objects/MarchingCubes.js';
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const len = (x, y, z) => Math.hypot(x, y, z);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const smooth01 = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export const smin = (a, b, k) => { const h = clamp(0.5 + 0.5 * (b - a) / k, 0, 1); return b + (a - b) * h - k * h * (1 - h); };
export const ssub = (d, cut, k) => -smin(-d, cut, k);
export function roundBox(px, py, pz, bx, by, bz, r) {
  const qx = Math.abs(px) - bx + r, qy = Math.abs(py) - by + r, qz = Math.abs(pz) - bz + r;
  return len(Math.max(qx, 0), Math.max(qy, 0), Math.max(qz, 0)) + Math.min(Math.max(qx, qy, qz), 0) - r;
}
export function ellipsoid(px, py, pz, rx, ry, rz) {
  const k0 = len(px / rx, py / ry, pz / rz), k1 = len(px / (rx * rx), py / (ry * ry), pz / (rz * rz));
  return k0 * (k0 - 1) / (k1 || 1e-6);
}
export function superEllipsoid(px, py, pz, a, b, c, p) {
  const k = Math.pow(Math.pow(Math.abs(px / a), p) + Math.pow(Math.abs(py / b), p) + Math.pow(Math.abs(pz / c), p), 1 / p);
  return (k - 1) * Math.min(a, b, c);
}
export function capsule(px, py, pz, ax, ay, az, bx, by, bz, r) {
  const pax = px - ax, pay = py - ay, paz = pz - az, bax = bx - ax, bay = by - ay, baz = bz - az;
  const h = clamp((pax * bax + pay * bay + paz * baz) / (bax * bax + bay * bay + baz * baz), 0, 1);
  return len(pax - bax * h, pay - bay * h, paz - baz * h) - r;
}
/** A root: tapers from r0 at the top to r1 at the tip, with an elliptical section (fx, fz), curving by bend along x. */
export function root(px, py, pz, x0, x1, top, tip, r0, r1, fx, fz, bend) {
  const t = clamp((top - py) / (top - tip), 0, 1);
  const cx = x0 + (x1 - x0) * t + bend * t * t;
  const r = r0 + (r1 - r0) * Math.pow(t, 0.9);
  let d = (Math.hypot((px - cx) / fx, pz / fz) - r) * Math.min(fx, fz);
  if (py < tip) d = len((px - (x1 + bend)) / fx, (py - tip) / 0.9, pz / fz) * Math.min(fx, fz) - r1 * Math.min(fx, fz);
  if (py > top) d = Math.max(d, py - top);
  return d;
}

/** Meshes the zero surface of sdf inside a box (centre, half size) at the given resolution. */
export function mesh(sdf, centre, half, res, maxPoly = 900000) {
  const mc = new MarchingCubes(res, new THREE.MeshBasicMaterial(), false, false, maxPoly);
  mc.isolation = 0;
  for (let k = 0; k < res; k++) for (let j = 0; j < res; j++) for (let i = 0; i < res; i++) {
    const x = ((i - res / 2) / (res / 2)) * half + centre[0];
    const y = ((j - res / 2) / (res / 2)) * half + centre[1];
    const z = ((k - res / 2) / (res / 2)) * half + centre[2];
    mc.field[i + j * res + k * res * res] = -sdf(x, y, z);
  }
  mc.update();
  const n = mc.count, pos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i += 3) {
    pos[i] = mc.positionArray[i] * half + centre[0];
    pos[i + 1] = mc.positionArray[i + 1] * half + centre[1];
    pos[i + 2] = mc.positionArray[i + 2] * half + centre[2];
  }
  const raw = new THREE.BufferGeometry();
  raw.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  return mergeVertices(raw, 1e-4);
}

/** Taubin smoothing (keeps the volume): removes the stepping left by meshing. */
export function smooth(geom, iters) {
  const p = geom.attributes.position.array, idx = geom.index.array, nv = p.length / 3;
  const nb = Array.from({ length: nv }, () => new Set());
  for (let t = 0; t < idx.length; t += 3) { const a = idx[t], b = idx[t + 1], c = idx[t + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  const lists = nb.map(s => [...s]), tmp = new Float32Array(p.length);
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
  geom.computeVertexNormals();
  return geom;
}

/** Splits a mesh in two by a test on each triangle's centre (e.g. crown above the gum line, root below). */
export function split(geom, keep) {
  const p = geom.attributes.position.array, nrm = geom.attributes.normal.array, idx = geom.index.array;
  const map = new Map(), P = [], N = [], I = [];
  for (let t = 0; t < idx.length; t += 3) {
    const a = idx[t], b = idx[t + 1], c = idx[t + 2];
    const cx = (p[a * 3] + p[b * 3] + p[c * 3]) / 3, cy = (p[a * 3 + 1] + p[b * 3 + 1] + p[c * 3 + 1]) / 3, cz = (p[a * 3 + 2] + p[b * 3 + 2] + p[c * 3 + 2]) / 3;
    if (!keep(cx, cy, cz)) continue;
    for (const v of [a, b, c]) {
      if (!map.has(v)) { map.set(v, P.length / 3); P.push(p[v * 3], p[v * 3 + 1], p[v * 3 + 2]); N.push(nrm[v * 3], nrm[v * 3 + 1], nrm[v * 3 + 2]); }
      I.push(map.get(v));
    }
  }
  return { P: new Float32Array(P), N: new Float32Array(N), I: P.length / 3 > 65535 ? new Uint32Array(I) : new Uint16Array(I) };
}
export const whole = geom => split(geom, () => true);

/**
 * Writes a glTF binary. Positions are stored as 16-bit integers with a scale
 * (KHR_mesh_quantization) and normals as 8-bit, which keeps the file small.
 * meshes: [{ name, P, N, I, material }]; nodes: [{ name, mesh?, translation?, rotation?, scale?, children? }]
 */
export function glb(meshes, nodes, rootNodes, materials) {
  const chunks = [], views = [], accessors = [];
  let offset = 0;
  const add = (arr, target) => {
    const buf = Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength); const pad = (4 - (buf.length % 4)) % 4;
    chunks.push(buf, Buffer.alloc(pad)); views.push({ buffer: 0, byteOffset: offset, byteLength: buf.length, ...(target ? { target } : {}) });
    offset += buf.length + pad; return views.length - 1;
  };
  const gMeshes = meshes.map(m => {
    let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9];
    for (let k = 0; k < m.P.length; k += 3) for (let a = 0; a < 3; a++) { min[a] = Math.min(min[a], m.P[k + a]); max[a] = Math.max(max[a], m.P[k + a]); }
    // quantise positions into the box [min, max] as normalised int16 (4 components keep the 4-byte alignment)
    const scale = [0, 1, 2].map(a => (max[a] - min[a]) / 2 || 1), mid = [0, 1, 2].map(a => (max[a] + min[a]) / 2);
    const q = new Int16Array((m.P.length / 3) * 4);
    for (let v = 0, o = 0; v < m.P.length; v += 3, o += 4) for (let a = 0; a < 3; a++) q[o + a] = Math.round(((m.P[v + a] - mid[a]) / scale[a]) * 32767);
    const n8 = new Int8Array((m.N.length / 3) * 4);
    for (let v = 0, o = 0; v < m.N.length; v += 3, o += 4) for (let a = 0; a < 3; a++) n8[o + a] = Math.round(clamp(m.N[v + a], -1, 1) * 127);
    const pv = add(q, 34962); views[pv].byteStride = 8;
    const nv = add(n8, 34962); views[nv].byteStride = 4;
    const iv = add(m.I, 34963);
    const base = accessors.length;
    accessors.push({ bufferView: pv, componentType: 5122, normalized: true, count: m.P.length / 3, type: 'VEC3', min: [-32767, -32767, -32767].map(x => x / 32767), max: [1, 1, 1] });
    accessors.push({ bufferView: nv, componentType: 5120, normalized: true, count: m.N.length / 3, type: 'VEC3' });
    accessors.push({ bufferView: iv, componentType: m.I instanceof Uint32Array ? 5125 : 5123, count: m.I.length, type: 'SCALAR' });
    return { mesh: { name: m.name, primitives: [{ attributes: { POSITION: base, NORMAL: base + 1 }, indices: base + 2, material: m.material ?? 0 }] }, scale, mid };
  });
  // each mesh sits under a node carrying its de-quantisation (scale + offset)
  const outNodes = [], meshNode = [];
  gMeshes.forEach((g, i) => { meshNode[i] = outNodes.length; outNodes.push({ name: meshes[i].name + '#q', mesh: i, translation: g.mid, scale: g.scale }); });
  const nodeIndex = new Map();
  for (const n of nodes) { nodeIndex.set(n.name, outNodes.length); outNodes.push({ name: n.name }); }
  for (const n of nodes) {
    const o = outNodes[nodeIndex.get(n.name)];
    if (n.translation) o.translation = n.translation;
    if (n.rotation) o.rotation = n.rotation;
    if (n.scale) o.scale = n.scale;
    const kids = [...(n.meshes || []).map(mi => meshNode[mi]), ...(n.children || []).map(c => nodeIndex.get(c))];
    if (kids.length) o.children = kids;
  }
  // a mesh used by several nodes needs its own copy of the de-quantisation node
  const used = new Set();
  for (const o of outNodes) for (const c of o.children || []) {
    if (used.has(c) && outNodes[c].mesh !== undefined) { const copy = { ...outNodes[c] }; outNodes.push(copy); o.children[o.children.indexOf(c)] = outNodes.length - 1; }
    used.add(c);
  }
  const json = {
    asset: { version: '2.0', generator: 'DentalFlow meshkit' }, extensionsUsed: ['KHR_mesh_quantization'], extensionsRequired: ['KHR_mesh_quantization'],
    scene: 0, scenes: [{ nodes: rootNodes.map(r => nodeIndex.get(r)) }], nodes: outNodes, meshes: gMeshes.map(g => g.mesh),
    materials, accessors, bufferViews: views, buffers: [{ byteLength: offset }],
  };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const bin = Buffer.concat(chunks);
  const header = Buffer.alloc(12); header.writeUInt32LE(0x46546c67, 0); header.writeUInt32LE(2, 4); header.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(js.length, 0); jh.writeUInt32LE(0x4e4f534a, 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.writeUInt32LE(0x004e4942, 4);
  return Buffer.concat([header, jh, js, bh, bin]);
}
