'use client';
/**
 * The two 3D scenes.
 *
 *  HeroScene   a molar floating among glass spheres, turning gently towards
 *              the pointer.
 *  StoryScene  the same molar, driven by how far the visitor has scrolled
 *              through the "What we do" section (progress 0 to 1, four stages):
 *                0  check-up and cleaning: the tooth turns, bright and clean
 *                1  fillings and root canals: it tilts to show the roots, which
 *                   light up, and a tooth-coloured inlay appears on the crown
 *                2  whitening: the enamel shifts from ivory to bright white
 *                3  braces and aligners: neighbouring teeth slide in and a
 *                   clear aligner shell fades in over them
 *
 * The tooth is a .glb model (public/models/molar.glb by default; the clinic's
 * choice is tooth3d in content/clinic.ts). The lighting is made in code.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, Lightformer, Float, PerformanceMonitor } from '@react-three/drei';
import * as THREE from 'three';
import type { MotionValue } from 'motion/react';
import { Tooth, useToothMaterials } from './Tooth';
import type { ToothLook } from './look';

import { SCENE_READY } from '../ReadyGate';

/** Tells the page (and its loading screen) that the 3D tooth is on screen. */
function Ready() {
  useEffect(() => {
    let id = requestAnimationFrame(() => { id = requestAnimationFrame(() => {
      (window as Window & { __dfSceneReady?: boolean }).__dfSceneReady = true;
      window.dispatchEvent(new Event(SCENE_READY));
    }); });
    return () => cancelAnimationFrame(id);
  }, []);
  return null;
}

const damp = THREE.MathUtils.damp;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
/** 0 → 1 as p goes from a to b */
const ramp = (p: number, a: number, b: number) => clamp01((p - a) / (b - a));
/** sharp on high-density screens, but never more than 1.5x pixels (the scenes are soft anyway) */
const maxDpr = () => Math.min(1.5, typeof window === 'undefined' ? 1 : window.devicePixelRatio || 1);
/** Neutral tone mapping keeps whites white and colours true (the default ACES look greys them). */
const neutralTone = ({ gl }: { gl: THREE.WebGLRenderer }) => { gl.toneMapping = THREE.NeutralToneMapping; };
const IVORY = new THREE.Color('#f4ede1');
const WHITE = new THREE.Color('#ffffff');

function Lights() {
  return (
    <>
      <hemisphereLight args={['#ffffff', '#b9d3de', 0.45]} />
      <directionalLight position={[3, 5, 4]} intensity={2.4} />
      <directionalLight position={[-4, 2, -2]} intensity={0.8} color="#bfe6f3" />
      {/* studio reflections, built from glowing panels instead of a downloaded HDR image;
          a pale backdrop so nothing reflects black */}
      <Environment resolution={256}>
        <color attach="background" args={['#b8cdd8']} />
        <Lightformer form="rect" intensity={3} position={[0, 4, -6]} scale={[10, 2, 1]} />
        <Lightformer form="rect" intensity={1.5} position={[0, -4, 3]} rotation={[Math.PI / 2, 0, 0]} scale={[10, 6, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#d8f1fa" position={[-6, 1, 0]} rotation={[0, Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="rect" intensity={1.2} position={[6, 1, 2]} rotation={[0, -Math.PI / 2, 0]} scale={[8, 4, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffffff" position={[0, 6, 4]} scale={3} />
      </Environment>
    </>
  );
}

/* ------------------------------------------------------------------ hero */
function GlassOrb({ position, scale }: { position: [number, number, number]; scale: number }) {
  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    // a soap-bubble glass: mostly see-through, with coloured reflections at the edges
    color: '#dff3fa', roughness: 0, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false,
    clearcoat: 1, clearcoatRoughness: 0, iridescence: 1, iridescenceIOR: 1.3, iridescenceThicknessRange: [180, 520], envMapIntensity: 2.2,
  }), []);
  return (
    <Float speed={1.2} rotationIntensity={0.2} floatIntensity={0.8}>
      <mesh position={position} scale={scale} material={mat}>
        <sphereGeometry args={[1, 64, 64]} />
      </mesh>
    </Float>
  );
}

function HeroTooth({ look }: { look: ToothLook }) {
  const group = useRef<THREE.Group>(null);
  const mats = useToothMaterials();
  const { pointer } = useThree();
  useFrame((state, dt) => {
    const g = group.current;
    if (!g) return;
    const t = state.clock.elapsedTime;
    g.rotation.y = damp(g.rotation.y, t * 0.35 + pointer.x * 0.5, 3, dt);
    g.rotation.x = damp(g.rotation.x, 0.16 - pointer.y * 0.22, 3, dt);   // tipped a little towards you, so the cusps show
  });
  return (
    <Float speed={1.6} rotationIntensity={0.15} floatIntensity={0.6}>
      <Tooth ref={group} look={look} materials={mats} />
    </Float>
  );
}

/** Scales the scene down so it fits a narrow or short canvas (phones, small windows). */
function Fit({ width, height, children }: { width: number; height: number; children: React.ReactNode }) {
  const { viewport } = useThree();
  const s = Math.min(1, viewport.width / width, viewport.height / height);
  return <group scale={s}>{children}</group>;
}

export function HeroScene({ host, look }: { host?: React.RefObject<HTMLElement | null>; look: ToothLook }) {
  const [dpr, setDpr] = useState(maxDpr);
  return (
    <Canvas dpr={dpr} camera={{ position: [0, 0.6, 5.2], fov: 38 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={neutralTone}>
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr())} />
      {host && <PauseWhenHidden host={host} />}
      <Lights />
      <Fit width={3.4} height={3.9}>
        <Suspense fallback={null}>
          <group position={[0, -0.05, 0]} scale={0.95}>
            <HeroTooth look={look} />
          </group>
          <Ready />
        </Suspense>
        <GlassOrb position={[-1.35, 1.0, -0.6]} scale={0.34} />
        <GlassOrb position={[1.3, -0.55, 0.4]} scale={0.24} />
        <GlassOrb position={[1.05, 1.35, -1.2]} scale={0.18} />
        <ContactShadows position={[0, -1.85, 0]} opacity={0.3} scale={6} blur={2.6} far={3.5} resolution={256} color="#0b5266" />
      </Fit>
    </Canvas>
  );
}

/* ----------------------------------------------------------------- story */
function StoryTeeth({ progress, still, look }: { progress: MotionValue<number> | null; still: boolean; look: ToothLook }) {
  const main = useRef<THREE.Group>(null);
  const left = useRef<THREE.Group>(null);
  const right = useRef<THREE.Group>(null);
  const mats = useToothMaterials();
  const sideMats = useToothMaterials();
  const p = useRef(0);

  useFrame((state, dt) => {
    const target = still ? 0.12 : clamp01(progress?.get() ?? 0);
    p.current = damp(p.current, target, 6, dt);
    const s = p.current * 3;                       // 0..3 across the four stages
    const g = main.current;
    if (!g) return;
    const idle = still ? 0 : state.clock.elapsedTime * 0.12;

    // turn steadily as the visitor scrolls; tilt back to show the roots in stage 1
    g.rotation.y = s * 1.9 + idle;
    g.rotation.x = 0.12 + 0.5 * ramp(s, 0.6, 1.2) - 0.55 * ramp(s, 1.6, 2.2) + 0.1 * ramp(s, 2.6, 3);
    g.rotation.z = 0.12 * Math.sin(s * 1.3);
    const scale = 1.05 - 0.08 * ramp(s, 2.5, 3);
    g.scale.setScalar(scale);
    g.position.y = 0.1 + 0.15 * ramp(s, 0.6, 1.2) - 0.15 * ramp(s, 1.6, 2.2) - 0.1 * ramp(s, 2.5, 3);

    // stage 1: roots glow, an inlay appears; both fade by stage 2
    const s1 = ramp(s, 0.6, 1.0) * (1 - ramp(s, 1.6, 2.0));
    mats.root.emissiveIntensity = 0.9 * s1;
    mats.filling.opacity = s1;
    // stage 2: ivory to bright white, with a stronger sheen
    const s2 = ramp(s, 1.5, 2.1);
    mats.enamel.color.copy(IVORY).lerp(WHITE, s2);
    mats.enamel.clearcoatRoughness = 0.18 - 0.12 * s2;
    mats.enamel.sheen = 0.3 + 0.7 * s2;
    // stage 3: neighbours slide in, the clear aligner fades in over all three
    const s3 = ramp(s, 2.4, 2.95);
    for (const [ref, side] of [[left, -1], [right, 1]] as const) {
      const n = ref.current;
      if (!n) continue;
      n.visible = s3 > 0.001;
      n.position.set(side * (1.95 + 2.5 * (1 - s3)), g.position.y - 0.05, -0.35 * s3);
      n.rotation.set(g.rotation.x * 0.6, -side * 0.35, 0);
      n.scale.setScalar(0.88 * scale);
    }
    sideMats.enamel.color.copy(mats.enamel.color);
    sideMats.enamel.opacity = s3;
    mats.shell.opacity = 0.42 * s3;
    sideMats.shell.opacity = 0.42 * s3;
  });

  return (
    <group position={[0, 0, 0]}>
      <Tooth ref={main} look={look} materials={mats} withFilling withShell />
      <Tooth ref={left} look={look} materials={sideMats} withShell visible={false} />
      <Tooth ref={right} look={look} materials={sideMats} withShell visible={false} />
    </group>
  );
}

function PauseWhenHidden({ host }: { host: React.RefObject<HTMLElement | null> }) {
  const { setFrameloop } = useThree() as unknown as { setFrameloop: (m: 'always' | 'never' | 'demand') => void };
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([e]) => setFrameloop(e.isIntersecting ? 'always' : 'never'), { rootMargin: '200px' });
    io.observe(el);
    return () => io.disconnect();
  }, [host, setFrameloop]);
  return null;
}

export function StoryScene({ progress, still, host, look }: { progress: MotionValue<number> | null; still: boolean; host?: React.RefObject<HTMLElement | null>; look: ToothLook }) {
  const [dpr, setDpr] = useState(maxDpr);
  return (
    <Canvas dpr={dpr} camera={{ position: [0, 0.4, 6.4], fov: 36 }} gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} onCreated={neutralTone}>
      <PerformanceMonitor onDecline={() => setDpr(1)} onIncline={() => setDpr(maxDpr())} />
      {host && <PauseWhenHidden host={host} />}
      <Lights />
      <Fit width={5.6} height={4.1}>
        <Suspense fallback={null}>
          <group position={[0, -0.05, 0]} scale={0.95}>
            <StoryTeeth progress={progress} still={still} look={look} />
          </group>
        </Suspense>
        <ContactShadows position={[0, -1.75, 0]} opacity={0.28} scale={9} blur={2.8} far={3.5} resolution={256} color="#0b5266" />
      </Fit>
    </Canvas>
  );
}

