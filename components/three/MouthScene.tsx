'use client';
/**
 * THE 3D MOUTH, driven by scroll.
 *
 * public/models/mouth.glb (made by scripts/make-mouth.mjs) holds 28 teeth
 * (FDI numbers t11…t47, each with a crown and a root) in two gums. As the
 * visitor scrolls, `stage` runs from 0 to 5 and the camera flies between
 * six viewpoints while each treatment plays out on the model:
 *   0  the smile (hero)
 *   1  check-up and cleaning: a scanning light sweeps across the teeth
 *   2  fillings and root canals: the jaw opens, the gums turn see-through,
 *      the roots of the lower right molar (46) light up and a filling appears
 *   3  whitening: the front teeth go from stained to bright white
 *   4  braces: brackets click onto the front teeth and the wire draws in
 *   5  implants: the lower left molar (36) is replaced by an implant screw,
 *      an abutment and a new crown
 * Everything is animated by changing a few numbers each frame; nothing is
 * re-created while scrolling.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, PerformanceMonitor, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { MotionValue } from 'motion/react';
import { SCENE_READY } from '../ReadyGate';

const MODEL = '/models/mouth.glb';
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
const sm = (a: number, b: number, x: number) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const maxDpr = () => Math.min(1.5, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
const v3 = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** The six viewpoints (camera position, point looked at), in millimetres. */
const KEYS: { pos: THREE.Vector3; look: THREE.Vector3; open: number }[] = [
  { pos: v3(78, 30, 138), look: v3(0, -1, 6), open: 0.07 },     // 0 smile
  { pos: v3(0, 12, 150), look: v3(0, 0, 8), open: 0.04 },       // 1 check-up
  { pos: v3(-84, 76, 116), look: v3(-15, -7, 4), open: 0.22 },   // 2 lower right molar
  { pos: v3(0, 4, 112), look: v3(0, 0, 22), open: 0.0 },        // 3 front teeth
  { pos: v3(-30, 6, 108), look: v3(0, 0, 20), open: 0.03 },     // 4 braces
  { pos: v3(84, 76, 116), look: v3(15, -7, 4), open: 0.22 },     // 5 lower left molar
];
export const STAGE_COUNT = KEYS.length;

/** Base sizes of the four tooth shapes in the model (see scripts/make-mouth.mjs). */
const FAMILY: Record<string, { h: number }> = { incisor: { h: 10 }, canine: { h: 10.5 }, premolar: { h: 8 }, molar: { h: 7.4 } };
const FRONT_UPPER = ['t13', 't12', 't11', 't21', 't22', 't23'];
const FRONT_LOWER = ['t43', 't42', 't41', 't31', 't32', 't33'];

const WHITE = new THREE.Color('#f8f6f1');
const STAIN = new THREE.Color('#e4d2a6');

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#c9d6e0', 0.55]} />
      <directionalLight position={[60, 120, 140]} intensity={2.2} />
      <directionalLight position={[-90, 30, 40]} intensity={0.7} color="#cfe4f4" />
      <Environment resolution={256}>
        <color attach="background" args={['#c4d1dc']} />
        <Lightformer form="rect" intensity={3} position={[0, 5, -6]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[0, -4, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={1.8} color="#e2f0fa" position={[-6, 1, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.4} position={[6, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={2.2} position={[0, 6, 5]} scale={3} />
      </Environment>
    </>
  );
}

function useMaterials() {
  return useMemo(() => {
    const enamel = new THREE.MeshPhysicalMaterial({ color: WHITE.clone(), roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.06, sheen: 0.3, sheenColor: new THREE.Color('#e6f2fa'), specularIntensity: 0.7 });
    // roots are hidden inside the gums, and only shown (faintly) in the x-ray view
    const root = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#efe3cc'), roughness: 0.5, clearcoat: 0.2, transparent: true, opacity: 0, depthWrite: false });
    const gum = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#d99ea0'), roughness: 0.42, clearcoat: 0.45, clearcoatRoughness: 0.3, sheen: 0.5, sheenColor: new THREE.Color('#ffe0e2'), transparent: true, opacity: 1 });
    return {
      enamel, root, gum,
      // the two teeth that get treated have their own materials
      crown46: enamel.clone(), root46: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#efe3cc'), roughness: 0.45, emissive: new THREE.Color('#19b4d8'), emissiveIntensity: 0 }),
      crown36: Object.assign(enamel.clone(), { transparent: true }),
      newCrown: Object.assign(enamel.clone(), { transparent: true, opacity: 0 }),
      filling: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#a8e3f0'), roughness: 0.15, clearcoat: 1, emissive: new THREE.Color('#0e7fa0'), emissiveIntensity: 0.5, transparent: true, opacity: 0 }),
      metal: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#c9d1d9'), metalness: 1, roughness: 0.28, clearcoat: 0.6 }),
      titanium: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#9aa6b2'), metalness: 1, roughness: 0.35, transparent: true, opacity: 0 }),
      wire: new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#dfe5ea'), metalness: 1, roughness: 0.2 }),
      scan: new THREE.MeshBasicMaterial({ color: new THREE.Color('#5fd4f0'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
    };
  }, []);
}
type Mats = ReturnType<typeof useMaterials>;

/** A screw with a thread, made on a lathe (millimetres). */
function screwGeometry() {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0, -11.2)];
  for (let i = 0; i <= 44; i++) {
    const y = -11 + i * 0.25;
    const thread = i % 4 < 2 ? 2.05 : 1.65;
    const taper = y < -9 ? 0.75 + (y + 11) * 0.12 : 1;
    pts.push(new THREE.Vector2(thread * taper, y));
  }
  pts.push(new THREE.Vector2(1.9, 0.2), new THREE.Vector2(0, 0.2));
  const g = new THREE.LatheGeometry(pts, 40);
  g.computeVertexNormals();
  return g;
}

type Rig = {
  root: THREE.Group; pivot: THREE.Group; lowerJaw: THREE.Object3D;
  brackets: THREE.Mesh[]; wires: THREE.Mesh[]; implant: THREE.Group; screw: THREE.Mesh; abutment: THREE.Mesh; newCrown: THREE.Object3D; filling: THREE.Mesh;
  scan: THREE.Mesh; scanLight: THREE.PointLight; root36: THREE.Object3D; upperJaw: THREE.Object3D; upperY: number;
};

function useMouth(mats: Mats): Rig {
  const gltf = useGLTF(MODEL);
  return useMemo(() => {
    const root = new THREE.Group();
    const model = gltf.scene.clone(true);
    root.add(model);
    // materials, by the name of each mesh's parent node: "t46-crown", "t11-root", "gum-upper"…
    model.traverse(o => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const n = m.parent?.name ?? '';
      m.material = n === 't46-crown' ? mats.crown46 : n === 't46-root' ? mats.root46 : n === 't36-crown' ? mats.crown36
        : n.startsWith('gum') ? mats.gum : n.endsWith('-root') ? mats.root : mats.enamel;
      m.renderOrder = n.startsWith('gum') ? 2 : 0;
    });
    // the lower jaw opens around a hinge behind and above the back teeth
    const lowerJaw = model.getObjectByName('jaw-lower')!;
    const hinge = v3(0, 22, -58);
    const pivot = new THREE.Group();
    pivot.position.copy(hinge);
    model.add(pivot);
    pivot.add(lowerJaw);
    lowerJaw.position.sub(hinge);
    model.updateMatrixWorld(true);

    const tooth = (name: string) => model.getObjectByName(name)!;
    /** a point on a tooth (in its own base units), in the space of `space` */
    const onTooth = (name: string, pick: (p: THREE.Vector3[]) => THREE.Vector3, space: THREE.Object3D) => {
      const crown = tooth(name + '-crown');
      const mesh = crown.children[0] as THREE.Mesh;
      const pos = mesh.geometry.attributes.position as THREE.BufferAttribute;
      const toTooth = new THREE.Matrix4().multiplyMatrices(crown.matrix, mesh.matrix);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < pos.count; i += 3) pts.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(toTooth));
      const local = pick(pts);
      return space.worldToLocal(tooth(name).localToWorld(local.clone()));
    };
    const axisOf = (name: string, axis: THREE.Vector3, space: THREE.Object3D) => {
      const t = tooth(name);
      const w = axis.clone().transformDirection(t.matrixWorld);
      return w.transformDirection(new THREE.Matrix4().copy(space.matrixWorld).invert()).normalize();
    };

    // braces: a bracket on the outer face of each front tooth, and a wire through them
    const bracketGeo = new THREE.BoxGeometry(3.2, 2.8, 1.3);
    const brackets: THREE.Mesh[] = [], wires: THREE.Mesh[] = [];
    for (const [names, jaw] of [[FRONT_UPPER, 'jaw-upper'], [FRONT_LOWER, 'jaw-lower']] as const) {
      const space = model.getObjectByName(jaw)!;
      const slots: THREE.Vector3[] = [];
      names.forEach(name => {
        const h = FAMILY.incisor.h;
        const p = onTooth(name, pts => {
          const band = pts.filter(q => Math.abs(q.y - h * 0.5) < h * 0.12 && Math.abs(q.x) < 1.2);
          return (band.length ? band : pts).reduce((a, b) => (b.z > a.z ? b : a)).clone();
        }, space);
        const out = axisOf(name, v3(0, 0, 1), space), up = axisOf(name, v3(0, 1, 0), space);
        const b = new THREE.Mesh(bracketGeo, mats.metal);
        b.position.copy(p).addScaledVector(out, 0.45);
        b.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3().crossVectors(up, out).normalize(), up, out));
        b.scale.setScalar(0.001);
        space.add(b);
        brackets.push(b);
        slots.push(p.clone().addScaledVector(out, 1.05));
      });
      const curve = new THREE.CatmullRomCurve3(slots, false, 'centripetal');
      const wire = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.3, 8), mats.wire);
      wire.geometry.setDrawRange(0, 0);
      space.add(wire);
      wires.push(wire);
    }

    // a filling on the biting surface of the lower right molar (46)
    const lowerSpace = lowerJaw;
    const fillingPos = onTooth('t46', pts => pts.reduce((a, b) => (b.y > a.y ? b : a)).clone().add(v3(0.6, -0.7, 0)), lowerSpace);
    const filling = new THREE.Mesh(new THREE.SphereGeometry(2.3, 32, 16), mats.filling);
    filling.position.copy(fillingPos);
    filling.scale.set(1.2, 0.45, 1);
    lowerSpace.add(filling);

    // the implant for the lower left molar (36): screw, abutment and a new crown
    const t36 = tooth('t36');
    const implant = new THREE.Group();
    implant.position.copy(lowerSpace.worldToLocal(t36.getWorldPosition(new THREE.Vector3())));
    const up36 = axisOf('t36', v3(0, 1, 0), lowerSpace);
    implant.quaternion.setFromUnitVectors(v3(0, 1, 0), up36);
    lowerSpace.add(implant);
    const screw = new THREE.Mesh(screwGeometry(), mats.titanium);
    implant.add(screw);
    const abutment = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.9, 3.2, 32), mats.titanium);
    abutment.position.y = 1.6;
    abutment.scale.setScalar(0.001);
    implant.add(abutment);
    const newCrown = tooth('t36-crown').clone(true);
    newCrown.traverse(o => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).material = mats.newCrown; });
    const crownHolder = new THREE.Group();
    t36.parent!.add(crownHolder);
    crownHolder.position.copy(t36.position); crownHolder.quaternion.copy(t36.quaternion); crownHolder.scale.copy(t36.scale);
    crownHolder.add(newCrown);

    // check-up: a scanning light that sweeps across the front of the teeth
    const scan = new THREE.Mesh(new THREE.BoxGeometry(0.5, 30, 0.5), mats.scan);
    const scanLight = new THREE.PointLight('#7fe3ff', 0, 40, 1.5);
    root.add(scan, scanLight);

    return { root, pivot, lowerJaw, brackets, wires, implant, screw, abutment, newCrown, filling, scan, scanLight, root36: tooth('t36-root'),
      upperJaw: model.getObjectByName('jaw-upper')!, upperY: model.getObjectByName('jaw-upper')!.position.y };
  }, [gltf.scene, mats]);
}

function Mouth({ stage, still }: { stage: MotionValue<number> | null; still: boolean }) {
  const mats = useMaterials();
  const rig = useMouth(mats);
  const s = useRef(0);
  const { camera, size, pointer } = useThree();
  const look = useRef(v3(0, 0, 8));
  const cam = useRef(new THREE.Vector3().copy(KEYS[0].pos));

  useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => {
      (window as Window & { __dfSceneReady?: boolean }).__dfSceneReady = true;
      window.dispatchEvent(new Event(SCENE_READY));
    }); });
    return () => cancelAnimationFrame(id);
  }, []);

  useFrame((state, dt) => {
    const target = still ? 0 : Math.max(0, Math.min(STAGE_COUNT - 1 + 0.6, stage?.get() ?? 0));
    // `window.__dfSnap = true` (used by the screenshot tests) jumps straight to the scroll position
    const snap = still || (window as Window & { __dfSnap?: boolean }).__dfSnap === true;
    s.current = snap ? target : THREE.MathUtils.damp(s.current, target, 5, Math.min(dt, 0.05));
    const S = s.current;

    // camera: rests on each viewpoint, then glides to the next
    const i = Math.min(STAGE_COUNT - 1, Math.floor(S)), j = Math.min(STAGE_COUNT - 1, i + 1);
    const g = sm(0.22, 0.78, S - i);
    const narrow = size.width < 768;
    const K = (k: number) => KEYS[k];
    const pos = K(i).pos.clone().lerp(K(j).pos, g);
    const lk = K(i).look.clone().lerp(K(j).look, g);
    if (narrow) {
      // phones: the camera stands further back (the screen is narrow), and the model
      // sits in the top part of the screen, above the text
      const back = Math.min(1.9, Math.max(1, 0.88 / (size.width / size.height)));
      pos.sub(lk).multiplyScalar(back).add(lk);
      const tall = 2 * pos.distanceTo(lk) * Math.tan(THREE.MathUtils.degToRad(17));
      lk.y -= 0.2 * tall; pos.y -= 0.2 * tall;
    }
    // the smile follows the pointer a little
    const idle = 1 - sm(0, 0.6, S);
    pos.x += idle * (pointer.x * 10 + Math.sin(state.clock.elapsedTime * 0.25) * 6);
    pos.y += idle * pointer.y * 6;
    const k = snap ? 1 : 1 - Math.exp(-6 * Math.min(dt, 0.05));
    cam.current.lerp(pos, k); look.current.lerp(lk, k);
    camera.position.copy(cam.current);
    camera.lookAt(look.current);
    // on wide screens the model sits in the right half, beside the text
    const pc = camera as THREE.PerspectiveCamera;
    const shift = narrow ? 0 : 7 * (document.documentElement.dir === 'rtl' ? 1 : -1);
    if (pc.filmOffset !== shift) { pc.filmOffset = shift; pc.updateProjectionMatrix(); }

    // jaw opening between viewpoints
    rig.pivot.rotation.x = -(K(i).open + (K(j).open - K(i).open) * g);
    // for the two lower molars (stages 2 and 5) the upper jaw lifts out of the way
    const lift = Math.max(sm(1.3, 1.75, S) * (1 - sm(2.25, 2.7, S)), sm(4.3, 4.75, S));
    rig.upperJaw.position.y = rig.upperY + 32 * lift;

    // 1 check-up: the scanning light sweeps from right to left across the front teeth
    const scanT = sm(0.55, 1.45, S);
    const scanOn = sm(0.45, 0.7, S) * (1 - sm(1.35, 1.6, S));
    const x = -34 + 68 * scanT;
    const z = 31 - (x * x) / 70;
    rig.scan.position.set(x, 0, z + 2);
    rig.scanLight.position.set(x, 0, z + 8);
    mats.scan.opacity = 0.7 * scanOn;
    rig.scanLight.intensity = 260 * scanOn;

    // 2 fillings and root canals: see-through gums, glowing roots, a filling
    const xray = sm(1.45, 1.9, S) * (1 - sm(2.35, 2.75, S));
    // (the gums also clear while the implant goes in, at stage 5)
    const see = Math.max(xray, sm(4.45, 4.7, S) * (1 - sm(5.25, 5.5, S)));
    mats.gum.opacity = 1 - 0.55 * see;
    mats.gum.depthWrite = see < 0.05;
    mats.root.opacity = 0.6 * see;
    mats.root.visible = see > 0.01;
    mats.root46.visible = xray > 0.01;
    mats.root46.emissiveIntensity = xray * (0.9 + 0.35 * Math.sin(state.clock.elapsedTime * 3));
    mats.filling.opacity = sm(1.7, 2.0, S) * (1 - sm(2.45, 2.75, S));

    // 3 whitening: stained teeth turn bright white as the visitor scrolls through
    const stain = sm(2.35, 2.75, S) * (1 - sm(2.95, 3.4, S));
    mats.enamel.color.copy(WHITE).lerp(STAIN, stain);
    mats.crown46.color.copy(mats.enamel.color);
    mats.enamel.clearcoatRoughness = 0.06 + 0.25 * stain;

    // 4 braces: brackets click on one by one, then the wire draws through them
    const brk = sm(3.45, 3.95, S) * (1 - sm(4.45, 4.7, S));
    rig.brackets.forEach((b, n) => {
      const local = clamp01(brk * 1.6 - (n % 6) * 0.1);
      b.scale.setScalar(Math.max(0.001, local));
    });
    const wire = sm(3.8, 4.15, S) * (1 - sm(4.45, 4.7, S));
    rig.wires.forEach(w => w.geometry.setDrawRange(0, Math.floor((w.geometry.index?.count ?? 0) * wire)));

    // 5 implants: the old tooth fades, the screw turns in, the abutment and crown follow
    const gone = sm(4.45, 4.7, S);
    mats.crown36.opacity = 1 - gone;
    mats.crown36.depthWrite = gone < 0.5;
    rig.root36.visible = gone < 0.5;
    const screwIn = sm(4.7, 5.05, S);
    mats.titanium.opacity = sm(4.6, 4.75, S);
    rig.screw.position.y = 12 * (1 - screwIn);
    rig.screw.rotation.y = -10 * (1 - screwIn);
    rig.abutment.scale.setScalar(Math.max(0.001, sm(5.0, 5.15, S)));
    const crownIn = sm(5.1, 5.45, S);
    mats.newCrown.opacity = sm(5.05, 5.2, S);
    rig.newCrown.position.y = 9 * (1 - crownIn);
  });

  return <primitive object={rig.root} />;
}

function PauseWhenHidden({ host }: { host: React.RefObject<HTMLElement | null> }) {
  const { setFrameloop } = useThree() as unknown as { setFrameloop: (m: 'always' | 'never' | 'demand') => void };
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? 'always' : 'never'));
    io.observe(el);
    return () => io.disconnect();
  }, [host, setFrameloop]);
  return null;
}

export function MouthScene({ stage, still, host }: { stage: MotionValue<number> | null; still: boolean; host?: React.RefObject<HTMLElement | null> }) {
  const [dpr, setDpr] = useState(maxDpr);
  return (
    <Canvas dpr={dpr} camera={{ position: KEYS[0].pos.toArray(), fov: 34, near: 5, far: 600 }}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.NeutralToneMapping; }}>
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr())} />
      {host && <PauseWhenHidden host={host} />}
      <Lights />
      <Suspense fallback={null}>
        <Mouth stage={stage} still={still} />
      </Suspense>
      <ContactShadows position={[0, -26, 0]} opacity={0.16} scale={140} blur={2.8} far={30} resolution={256} color="#0b2f52" />
    </Canvas>
  );
}

useGLTF.preload(MODEL);
