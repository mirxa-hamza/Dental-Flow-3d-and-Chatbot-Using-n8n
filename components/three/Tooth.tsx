'use client';
/**
 * One tooth, loaded from a .glb model file.
 *
 * The built-in model (public/models/molar.glb, made by scripts/make-molar.mjs)
 * has two parts named "crown" and "roots", so the roots can light up and the
 * clear aligner fits over the crown only. Any other model works too: it is
 * centred, turned and sized to the same height, and treated as all crown.
 */
import { forwardRef, useMemo } from 'react';
import * as THREE from 'three';
import { useGLTF } from '@react-three/drei';
import type { ThreeElements } from '@react-three/fiber';
import type { ToothLook } from './look';

export type ToothMaterials = {
  enamel: THREE.MeshPhysicalMaterial;
  root: THREE.MeshPhysicalMaterial;
  shell: THREE.MeshPhysicalMaterial;
  filling: THREE.MeshPhysicalMaterial;
  glass: THREE.MeshPhysicalMaterial;
};

/** Materials are created once per scene and animated directly (no re-render per frame). */
export function useToothMaterials(): ToothMaterials {
  return useMemo(() => ({
    enamel: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#f7f2e8'), roughness: 0.24, metalness: 0,
      clearcoat: 1, clearcoatRoughness: 0.08, sheen: 0.35, sheenRoughness: 0.45, sheenColor: new THREE.Color('#e6f4f9'),
      specularIntensity: 0.6,
    }),
    root: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#efe5d3'), roughness: 0.5, clearcoat: 0.25, clearcoatRoughness: 0.3,
      emissive: new THREE.Color('#14b8d6'), emissiveIntensity: 0,
    }),
    shell: new THREE.MeshPhysicalMaterial({
      // clear plastic: see-through with bright reflections (no transmission pass: the canvas is transparent)
      color: new THREE.Color('#e8f7fc'), roughness: 0.04, metalness: 0, transparent: true, opacity: 0,
      clearcoat: 1, clearcoatRoughness: 0.02, iridescence: 0.2, iridescenceIOR: 1.3, depthWrite: false, envMapIntensity: 1.4,
    }),
    filling: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#9ad9ea'), roughness: 0.2, clearcoat: 1, transparent: true, opacity: 0,
      emissive: new THREE.Color('#0e7490'), emissiveIntensity: 0.25,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: new THREE.Color('#dff2f8'), roughness: 0.03, metalness: 0, transparent: true, opacity: 0.6,
      clearcoat: 1, clearcoatRoughness: 0, iridescence: 0.55, iridescenceIOR: 1.35, iridescenceThicknessRange: [200, 600],
      envMapIntensity: 2.2, specularIntensity: 1,
    }),
  }), []);
}

const HEIGHT = 3; // every model is scaled to this height, so the scenes frame any tooth the same way

type Part = { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4; kind: 'crown' | 'roots'; own: THREE.Material | THREE.Material[] };

/** Flattens the model into its meshes, each with a matrix that centres, turns and sizes it. */
function prepare(scene: THREE.Object3D, look: ToothLook) {
  const wrap = new THREE.Group();
  const d = THREE.MathUtils.degToRad;
  wrap.rotation.set(d(look.rotation[0]), d(look.rotation[1]), d(look.rotation[2]));
  wrap.add(scene.clone(true));
  wrap.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(wrap);
  const size = box.getSize(new THREE.Vector3()), centre = box.getCenter(new THREE.Vector3());
  const s = (HEIGHT / Math.max(size.y, 1e-6)) * (look.scale || 1);
  const fit = new THREE.Matrix4().makeScale(s, s, s).multiply(new THREE.Matrix4().makeTranslation(-centre.x, -centre.y, -centre.z));

  const named = (o: THREE.Object3D | null, n: string): boolean => !!o && (o.name.toLowerCase().includes(n) || named(o.parent, n));
  const parts: Part[] = [];
  wrap.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    parts.push({ geometry: m.geometry, matrix: fit.clone().multiply(m.matrixWorld), kind: named(m, 'root') ? 'roots' : 'crown', own: m.material });
  });
  const crownBox = new THREE.Box3();
  for (const p of parts) if (p.kind === 'crown') {
    p.geometry.computeBoundingBox();
    crownBox.union(p.geometry.boundingBox!.clone().applyMatrix4(p.matrix));
  }
  const c = crownBox.getCenter(new THREE.Vector3());
  // the aligner: the crown again, a little larger around its own centre
  const shell = new THREE.Matrix4().makeTranslation(c.x, c.y, c.z)
    .multiply(new THREE.Matrix4().makeScale(1.06, 1.05, 1.06)).multiply(new THREE.Matrix4().makeTranslation(-c.x, -c.y, -c.z));
  return { parts, crownBox, shell };
}

type Props = ThreeElements['group'] & { look: ToothLook; materials: ToothMaterials; withShell?: boolean; withFilling?: boolean };

export const Tooth = forwardRef<THREE.Group, Props>(function Tooth({ look, materials, withShell, withFilling, ...props }, ref) {
  const gltf = useGLTF(look.file);
  const { parts, crownBox, shell } = useMemo(() => prepare(gltf.scene, look), [gltf.scene, look]);
  const pick = (p: Part) => (look.finish === 'own' ? p.own : look.finish === 'glass' ? materials.glass : p.kind === 'roots' ? materials.root : materials.enamel);
  const top = crownBox.max.y, w = crownBox.max.x - crownBox.min.x, depth = crownBox.max.z - crownBox.min.z;

  return (
    <group ref={ref} {...props}>
      {parts.map((p, i) => (
        <mesh key={i} geometry={p.geometry} material={pick(p)} matrixAutoUpdate={false} matrix={p.matrix} />
      ))}
      {withFilling && Number.isFinite(top) && (
        <mesh position={[w * 0.16, top - 0.06, depth * 0.1]} rotation={[0.08, 0, -0.1]} scale={[w * 0.11, 1, depth * 0.12]} material={materials.filling}>
          <cylinderGeometry args={[1, 0.85, 0.1, 40]} />
        </mesh>
      )}
      {withShell && parts.filter(p => p.kind === 'crown').map((p, i) => (
        <mesh key={'s' + i} geometry={p.geometry} material={materials.shell} matrixAutoUpdate={false}
          matrix={shell.clone().multiply(p.matrix)} renderOrder={2} />
      ))}
    </group>
  );
});

/** Start downloading a model before the scene needs it. */
export const preloadTooth = (file: string) => useGLTF.preload(file);
