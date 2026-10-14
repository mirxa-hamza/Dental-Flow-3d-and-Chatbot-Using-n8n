import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { createMouthFraming } from '../components/three/framing.ts';

const bytes = await readFile(new URL('../public/models/mouth.glb', import.meta.url));
const { scene } = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '');
const lower = scene.getObjectByName('jaw-lower');
const upper = scene.getObjectByName('jaw-upper');
const upperY = upper.position.y;
const pivot = new THREE.Group();
pivot.position.set(0, 22, -58);
scene.add(pivot);
pivot.add(lower);
lower.position.sub(pivot.position);
const fit = createMouthFraming(scene);
const views = [[78,30,138,0,-1,6,.07], [0,12,150,0,0,8,.04], [-84,76,116,-15,-7,4,.22], [0,4,112,0,0,22,0], [-30,6,108,0,0,20,.03], [84,76,116,15,-7,4,.22]];
const smooth = (a,b,s) => { const t = THREE.MathUtils.clamp((s-a)/(b-a),0,1); return t*t*(3-2*t); };
let frames = 0;
for (const [width,height] of [[320,568],[375,667],[390,844],[430,932],[667,375],[768,1024],[1024,768],[1440,900],[1773,814]]) {
  for (const rtl of [false,true]) {
    const camera = new THREE.PerspectiveCamera(34,width/height,5,600);
    for (let step=0; step<=112; step++) {
      const stage=step/20;
      const a=views[Math.min(5,Math.floor(stage))], b=views[Math.min(5,Math.floor(stage)+1)];
      const t=smooth(.22,.78,stage-Math.floor(stage));
      camera.position.fromArray(a).lerp(new THREE.Vector3(...b.slice(0,3)),t);
      camera.lookAt(new THREE.Vector3(...a.slice(3,6)).lerp(new THREE.Vector3(...b.slice(3,6)),t));
      pivot.rotation.x=-(a[6]+(b[6]-a[6])*t);
      upper.position.y=upperY+32*Math.max(smooth(1.3,1.75,stage)*(1-smooth(2.25,2.7,stage)),smooth(4.3,4.75,stage));
      fit(camera,width,height,rtl,80);
      const narrow=width<768;
      const left=width*(narrow?.05:rtl?.05:.43),right=width*(narrow?.95:rtl?.57:.95);
      const top=Math.max(96,height*.12),bottom=Math.max(top+40,height*(narrow?.52:.92));
      scene.traverse(mesh => {
        if (!mesh.isMesh) return;
        const box=mesh.geometry.boundingBox;
        for (let c=0;c<8;c++) {
          const p=new THREE.Vector3(c&1?box.max.x:box.min.x,c&2?box.max.y:box.min.y,c&4?box.max.z:box.min.z).applyMatrix4(mesh.matrixWorld).project(camera);
          const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
          assert(x>=left-.01 && x<=right+.01 && y>=top-.01 && y<=bottom+.01 && p.z>=-1 && p.z<=1, `Clipping at ${width}x${height}, stage ${stage}, RTL ${rtl}: ${x},${y}`);
        }
      });
      frames++;
    }
  }
}
console.log(`Passed ${frames} projected frames across 9 viewport sizes, all stages, LTR and RTL.`);
