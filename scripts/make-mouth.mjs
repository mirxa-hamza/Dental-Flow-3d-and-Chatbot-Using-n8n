/**
 * Builds public/models/mouth.glb: a full adult set of teeth (28, upper and
 * lower) set in gums, made in code so the website can move the camera to any
 * tooth and change any part of it.
 *
 *   node scripts/make-mouth.mjs
 *
 * Inside the file (units: millimetres, the mouth faces +z):
 *   jaw-upper, jaw-lower                 the two jaws (the lower one opens)
 *   gum-upper, gum-lower                 the gums
 *   t11 … t47                            one node per tooth, FDI numbering
 *     crown / root                       each tooth's enamel and root
 * Patient's right is -x (FDI 1x and 4x), patient's left is +x (2x and 3x).
 */
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { capsule, clamp, ellipsoid, glb, mesh, root, roundBox, smin, smooth, smooth01, split, ssub, superEllipsoid, whole } from './meshkit.mjs';

const OUT = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'public', 'models', 'mouth.glb');

/* ------------------------------------------------------------ tooth shapes
   Each family is built once at a standard size, with the gum line (CEJ) at
   y = 0, the crown towards +y and the outer (lip/cheek) side towards +z.
   Every tooth is then that shape scaled to its own size.                    */
const FAM = {
  incisor: { w: 8, d: 7, h: 10, r: 13, sdf(x, y, z) {
    const { w, d, h, r } = FAM.incisor;
    const yy = clamp(y, 0, h);
    const a = (w / 2) * (0.74 + 0.26 * smooth01(0, 0.75 * h, yy));             // narrow at the neck, widest near the edge
    const c = (d / 2) * (1 - 0.72 * smooth01(0.15 * h, h, yy));                 // thin towards the biting edge
    const zc = -0.35 * smooth01(0.3 * h, h, yy);                               // edge sits a little behind the lip side
    let s = superEllipsoid(x / a * (w / 2), (y - h / 2), (z - zc) / c * (d / 2), w / 2, h / 2, d / 2, 2.6);
    s = smin(s, ellipsoid(x, y - 0.25 * h, z + 0.3 * d, 0.55 * a, 0.22 * h, 0.22 * d), 0.8);   // cingulum
    const rt = root(x, y, z, 0, 0, 0.4, -r, 0.36 * w, 0.45, 1, 1.15, 0);
    return smin(s, rt, 1.2);
  } },
  canine: { w: 7.5, d: 8, h: 10.5, r: 16, sdf(x, y, z) {
    const { w, d, h, r } = FAM.canine;
    const yy = clamp(y, 0, h);
    const a = (w / 2) * (0.78 + 0.25 * smooth01(0, 0.5 * h, yy)) * (1 - 0.82 * smooth01(0.55 * h, h, yy));   // to a point
    const c = (d / 2) * (1 - 0.6 * smooth01(0.3 * h, h, yy));
    let s = superEllipsoid(x / Math.max(a, 0.3) * (w / 2), (y - h / 2), z / c * (d / 2), w / 2, h / 2, d / 2, 2.4);
    s = smin(s, ellipsoid(x, y - 0.3 * h, z - 0.18 * d, 0.38 * w, 0.32 * h, 0.2 * d), 1.0);   // labial ridge
    const rt = root(x, y, z, 0, 0.2, 0.4, -r, 0.36 * w, 0.5, 0.95, 1.2, 0.6);
    return smin(s, rt, 1.3);
  } },
  premolar: { w: 7, d: 9, h: 8, r: 14, sdf(x, y, z) {
    const { w, d, h, r } = FAM.premolar;
    let s = superEllipsoid(x, y - 0.45 * h, z, w / 2, 0.45 * h, d / 2, 2.6);
    s = smin(s, ellipsoid(x, y - 0.82 * h, z - 0.22 * d, 0.34 * w, 0.22 * h, 0.26 * d), 1.0);   // buccal cusp (taller)
    s = smin(s, ellipsoid(x, y - 0.74 * h, z + 0.24 * d, 0.3 * w, 0.18 * h, 0.22 * d), 1.0);    // lingual cusp
    s = ssub(s, capsule(x, y, z, -0.6 * w, 1.0 * h, 0.02 * d, 0.6 * w, 1.0 * h, 0.02 * d, 0.55), 0.6);   // central groove
    const rt = root(x, y, z, 0, 0.3, 0.3, -r, 0.42 * w, 0.55, 0.75, 1.2, 0.5);
    return smin(s, rt, 1.3);
  } },
  molar: { w: 10.4, d: 9.6, h: 7.4, r: 12, sdf(x, y, z) {
    // the website's single molar (scripts/make-molar.mjs), at 1 unit = 5 mm, outer side towards +z
    const k = 5, X = x / k, Y = (y - 1.1) / k, Z = -z / k;
    const sm = (a, b, x2) => smooth01(a, b, x2);
    const s0 = 1 - 0.06 * sm(0.55, 1.0, Y);
    let d = superEllipsoid(X / s0, Y - 0.5, Z / s0, 1.04, 0.52, 0.88, 2.7);
    for (const [cx, cy, cz, r] of [[-0.56, 0.8, 0.4, 0.4], [0.04, 0.82, 0.46, 0.38], [0.6, 0.77, 0.36, 0.34], [-0.4, 0.86, -0.38, 0.42], [0.44, 0.85, -0.38, 0.4]])
      d = smin(d, ellipsoid(X - cx, Y - cy, Z - cz, r, r * 0.6, r), 0.3);
    d = ssub(d, capsule(X, Y, Z, -0.8, 1.07, 0.03, 0.8, 1.07, -0.03, 0.09), 0.12);
    d = ssub(d, capsule(X, Y, Z, -0.26, 1.07, 0.0, -0.32, 1.02, 0.8, 0.06), 0.1);
    d = ssub(d, capsule(X, Y, Z, 0.32, 1.07, 0.0, 0.36, 1.0, 0.8, 0.06), 0.1);
    d = ssub(d, capsule(X, Y, Z, 0.02, 1.07, 0.0, 0.02, 1.03, -0.8, 0.06), 0.1);
    d = smin(d, superEllipsoid(X, Y + 0.25, Z, 0.74, 0.42, 0.62, 2.6), 0.42);
    const m = root(X, Y, Z, -0.42, -0.5, -0.25, -2.25, 0.54, 0.16, 0.66, 1, 0.2);
    const di = root(X, Y, Z, 0.44, 0.52, -0.25, -2.1, 0.5, 0.16, 0.64, 1, 0.16);
    d = smin(d, smin(m, di, 0.1), 0.34);
    return d * k;
  } },
};

function buildFamily(name) {
  const f = FAM[name];
  const top = f.h + 1.5, bottom = -f.r - 1.5, half = Math.max((top - bottom) / 2, f.w, f.d) + 0.5;
  const g = smooth(mesh(f.sdf, [0, (top + bottom) / 2, 0], half, 104), 6);
  const cej = (x, z) => 0.25 + 0.6 * Math.pow(Math.abs(x) / (f.w / 2), 2);   // the gum line dips between teeth
  return { crown: split(g, (x, y, z) => y > cej(x, z)), root: split(g, (x, y, z) => y <= cej(x, z)) };
}

/* ------------------------------------------------------------ the arches */
// sizes in mm: width (mesio-distal), depth (bucco-lingual), crown height, root length
const UPPER = [['incisor', 8.6, 7, 10.5, 13], ['incisor', 6.6, 6, 9, 13], ['canine', 7.6, 8, 10, 17], ['premolar', 7, 9, 8.5, 14], ['premolar', 6.7, 9, 8, 14], ['molar', 10.2, 11, 7.5, 12.5], ['molar', 9.2, 10.5, 7, 12]];
const LOWER = [['incisor', 5.3, 5.8, 9, 12.5], ['incisor', 5.9, 6.1, 9.5, 13.5], ['canine', 6.9, 7.6, 11, 16], ['premolar', 7, 7.6, 8.5, 14], ['premolar', 7.1, 8, 8, 14.5], ['molar', 11.2, 10.4, 7.5, 13], ['molar', 10.5, 10.2, 7, 12.5]];
// arch forms through these points (x, z), mirrored for the other side
const archPts = (sx, sz, front) => [[0, front], [8 * sx, front - 3 * sz], [16 * sx, front - 9 * sz], [21.5 * sx, front - 17 * sz], [24.5 * sx, front - 26 * sz], [26.5 * sx, front - 37 * sz], [27.5 * sx, front - 48 * sz]];
function archCurve(sx, sz, front) {
  const half = archPts(sx, sz, front);
  const pts = [...half.slice(1).reverse().map(([x, z]) => new THREE.Vector3(-x, 0, z)), ...half.map(([x, z]) => new THREE.Vector3(x, 0, z))];
  return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
}
const ARCH = { upper: archCurve(1, 1, 31), lower: archCurve(0.93, 0.95, 28.6) };

function placeTeeth(jaw) {
  const list = jaw === 'upper' ? UPPER : LOWER, curve = ARCH[jaw], L = curve.getLength(), mid = L / 2;
  const out = [];
  for (const side of [-1, 1]) {           // -1 = patient's right (quadrant 1 / 4), +1 = left (2 / 3)
    let s = -0.3;                         // the two front teeth meet at the midline
    list.forEach(([fam, w, d, h, r], i) => {
      const sMid = s + w / 2; s += w - 0.35;              // neighbouring teeth touch at their contact points
      const u = (mid + side * sMid) / L;
      const p = curve.getPointAt(u), t = curve.getTangentAt(u).normalize();
      const tangent = t.clone().multiplyScalar(side);                 // points away from the midline
      const outward = new THREE.Vector3(tangent.z * side, 0, -tangent.x * side);   // towards the lips and cheeks
      if (outward.dot(p) < 0) outward.negate();
      const quadrant = jaw === 'upper' ? (side < 0 ? 1 : 2) : (side < 0 ? 4 : 3);
      out.push({ name: `t${quadrant}${i + 1}`, fam, w, d, h, r, p, tangent: tangent.normalize(), outward: outward.normalize(), side, index: i, sMid, u });
    });
  }
  return out;
}
const OVERBITE = 2.2, OPEN = 0;
function toothNode(t, jaw) {
  const F = FAM[t.fam];
  const up = jaw === 'upper' ? -1 : 1;                                  // upper crowns point down
  const cejY = jaw === 'upper' ? t.h - (t.fam === 'incisor' || t.fam === 'canine' ? OVERBITE : 0.3) : -t.h;
  // local frame: x along the arch (away from the midline), y crown direction, z outward
  const xAxis = t.tangent.clone().multiplyScalar(t.side > 0 ? 1 : -1), yAxis = new THREE.Vector3(0, up, 0), zAxis = t.outward.clone();
  // right-handed frame: if not, mirror x in the scale instead
  const handed = new THREE.Vector3().crossVectors(xAxis, yAxis).dot(zAxis) > 0 ? 1 : -1;
  const m = new THREE.Matrix4().makeBasis(xAxis.clone().multiplyScalar(handed), yAxis, zAxis);
  // incisors lean forward a little
  const tilt = (t.fam === 'incisor' ? 0.22 : t.fam === 'canine' ? 0.12 : 0.03) * (jaw === 'upper' ? 1 : 0.6);
  const q = new THREE.Quaternion().setFromRotationMatrix(m).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
  const pos = new THREE.Vector3(t.p.x, cejY, t.p.z);
  return { ...t, name: t.name, translation: pos.toArray(), rotation: q.toArray(), scale: [(t.w / F.w) * handed, t.h / F.h, t.d / F.d], cejY };
}

/* ------------------------------------------------------------ gums */
function buildGum(jaw, teeth) {
  const curve = ARCH[jaw], N = 1600;
  const pts = Array.from({ length: N + 1 }, (_, i) => curve.getPointAt(i / N));
  const up = jaw === 'upper' ? -1 : 1;
  const byS = [...teeth].sort((a, b) => a.u - b.u);
  const uFirst = byS[0].u, uLast = byS[byS.length - 1].u;
  const info = u => {
    let k = byS.findIndex(t => t.u > u); if (k < 0) k = byS.length;
    const a = byS[Math.max(0, k - 1)], b = byS[Math.min(byS.length - 1, k)];
    const f = a === b ? 0 : (u - a.u) / Math.max(1e-6, b.u - a.u);
    return { depth: a.d + (b.d - a.d) * f, cej: a.cejY + (b.cejY - a.cejY) * f, papilla: a === b ? 0 : Math.sin(Math.PI * f) ** 2 };
  };
  const smax = (a, b, k) => -smin(-a, -b, k);
  const sdf = (x, y, z) => {
    // closest point on the arch, in the horizontal plane (exact, on the segments)
    let best = 1e9, bi = 0;
    for (let i = 0; i <= N; i += 10) { const dx = x - pts[i].x, dz = z - pts[i].z, dd = dx * dx + dz * dz; if (dd < best) { best = dd; bi = i; } }
    let cx = 0, cz = 0, cu = 0; best = 1e9;
    for (let i = Math.max(0, bi - 12); i < Math.min(N, bi + 12); i++) {
      const ax = pts[i].x, az = pts[i].z, bx = pts[i + 1].x, bz = pts[i + 1].z;
      const vx = bx - ax, vz = bz - az, t = clamp(((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz), 0, 1);
      const px = ax + vx * t, pz = az + vz * t, dd = (x - px) ** 2 + (z - pz) ** 2;
      if (dd < best) { best = dd; cx = px; cz = pz; cu = (i + t) / N; }
    }
    // the gum ends a little past the last molar on each side
    const uc = clamp(cu, uFirst - 0.035, uLast + 0.035);
    const pc = curve.getPointAt(clamp(uc, 0, 1)), tang = curve.getTangentAt(clamp(uc, 0, 1));
    const out = new THREE.Vector3(tang.z, 0, -tang.x); if (out.x * pc.x + out.z * pc.z < 0) out.negate();
    const n = (x - pc.x) * out.x + (z - pc.z) * out.z;
    const along = Math.abs((x - pc.x) * tang.x + (z - pc.z) * tang.z);
    const { depth, cej, papilla } = info(clamp(cu, uFirst, uLast));
    // a rounded ridge around the roots, cut at the gum line (higher between the teeth)
    const rx = depth / 2 + 1.0, ry = 6.8, yc = cej - up * 4.2;
    const e = ellipsoid(n, y - yc, along, rx, ry, 1e9);
    const ridge = Math.hypot(Math.max(e, 0), Math.max(along - 0.0, 0) * (cu < uFirst - 0.035 || cu > uLast + 0.035 ? 1 : 0)) + Math.min(e, 0);
    const margin = cej + up * (0.2 + 1.5 * papilla);
    return smax(ridge, up * (y - margin), 1.2);
  };
  const ys = teeth.map(t => t.cejY);
  const yMid = jaw === 'upper' ? Math.max(...ys) + 4 : Math.min(...ys) - 4;
  return smooth(mesh(sdf, [0, yMid, 2], 41, 136), 6);
}

/* ------------------------------------------------------------ build */
const t0 = Date.now();
const families = Object.fromEntries(Object.keys(FAM).map(n => [n, buildFamily(n)]));
console.log('teeth shapes', Date.now() - t0, 'ms', Object.entries(families).map(([n, f]) => `${n}:${(f.crown.I.length + f.root.I.length) / 3}`).join(' '));

const meshes = [], meshIx = {};
for (const [n, f] of Object.entries(families)) {
  meshIx[n + ':crown'] = meshes.push({ name: `${n}-crown`, ...f.crown, material: 0 }) - 1;
  meshIx[n + ':root'] = meshes.push({ name: `${n}-root`, ...f.root, material: 1 }) - 1;
}
const nodes = [], jawsOut = {};
for (const jaw of ['upper', 'lower']) {
  const teeth = placeTeeth(jaw).map(t => toothNode(t, jaw));
  const gum = whole(buildGum(jaw, teeth));
  const gi = meshes.push({ name: `gum-${jaw}`, ...gum, material: 2 }) - 1;
  console.log(`gum ${jaw}`, gum.I.length / 3, 'triangles', Date.now() - t0, 'ms');
  for (const t of teeth) {
    nodes.push({ name: `${t.name}-crown`, meshes: [meshIx[t.fam + ':crown']] });
    nodes.push({ name: `${t.name}-root`, meshes: [meshIx[t.fam + ':root']] });
    nodes.push({ name: t.name, translation: t.translation, rotation: t.rotation, scale: t.scale, children: [`${t.name}-crown`, `${t.name}-root`] });
  }
  nodes.push({ name: `gum-${jaw}`, meshes: [gi] });
  nodes.push({ name: `jaw-${jaw}`, children: [`gum-${jaw}`, ...teeth.map(t => t.name)] });
  jawsOut[jaw] = teeth.map(t => ({ name: t.name, fam: t.fam, w: t.w, d: t.d, h: t.h, pos: t.translation }));
}
const materials = [
  { name: 'enamel', pbrMetallicRoughness: { baseColorFactor: [0.96, 0.94, 0.9, 1], metallicFactor: 0, roughnessFactor: 0.3 } },
  { name: 'root', pbrMetallicRoughness: { baseColorFactor: [0.93, 0.88, 0.78, 1], metallicFactor: 0, roughnessFactor: 0.5 } },
  { name: 'gum', pbrMetallicRoughness: { baseColorFactor: [0.86, 0.5, 0.52, 1], metallicFactor: 0, roughnessFactor: 0.45 } },
];
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, glb(meshes, nodes, ['jaw-upper', 'jaw-lower'], materials));
fs.writeFileSync(OUT.replace(/\.glb$/, '.json'), JSON.stringify(jawsOut));
console.log(`mouth.glb ${(fs.statSync(OUT).size / 1024).toFixed(0)} KB in ${Date.now() - t0} ms`);
