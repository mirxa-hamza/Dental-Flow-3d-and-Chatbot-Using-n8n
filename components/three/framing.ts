import * as THREE from 'three';

/** Fit animated mesh bounds into a pixel rectangle without changing the viewing angle. */
export function createMouthFraming(root: THREE.Object3D) {
  const meshes: THREE.Mesh[] = [];
  root.traverse(object => {
    const mesh = object as THREE.Mesh;
    if (mesh.isMesh && mesh.name !== 'scan') {
      mesh.geometry.computeBoundingBox();
      meshes.push(mesh);
    }
  });
  const bounds = new THREE.Box3();
  const inverse = new THREE.Quaternion();
  const point = new THREE.Vector3();
  const center = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const offset = new THREE.Vector3();
  const points = meshes.map(() => Array.from({ length: 8 }, () => new THREE.Vector3()));

  return (camera: THREE.PerspectiveCamera, width: number, height: number, rtl: boolean, headerBottom = 80) => {
    const narrow = width < 768;
    const left = width * (narrow ? 0.05 : rtl ? 0.05 : 0.43);
    const right = width * (narrow ? 0.95 : rtl ? 0.57 : 0.95);
    const top = Math.max(headerBottom + 16, height * 0.12);
    const bottom = Math.max(top + 40, height * (narrow ? 0.52 : 0.92));
    const halfWidth = (right - left) / width;
    const halfHeight = (bottom - top) / height;
    inverse.copy(camera.quaternion).invert();
    matrix.makeRotationFromQuaternion(inverse);
    root.updateWorldMatrix(true, true);
    bounds.makeEmpty();
    meshes.forEach((mesh, index) => {
      const box = mesh.geometry.boundingBox!;
      for (let corner = 0; corner < 8; corner++) {
        const p = points[index][corner];
        p.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z)
          .applyMatrix4(mesh.matrixWorld).applyMatrix4(matrix);
        bounds.expandByPoint(p);
      }
    });
    bounds.getCenter(center);
    const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / camera.zoom;
    const tanX = tanY * camera.aspect;
    let distance = 0;
    for (const corners of points) for (const p of corners) {
      point.copy(p).sub(center);
      distance = Math.max(distance, point.z + Math.abs(point.x) / (tanX * halfWidth),
        point.z + Math.abs(point.y) / (tanY * halfHeight), point.z + camera.near + 1);
    }
    camera.position.copy(center).add(offset.set(0, 0, distance * 1.04)).applyQuaternion(camera.quaternion);
    camera.far = Math.max(600, distance * 1.04 + center.z - bounds.min.z + 50);
    camera.filmOffset = 0;
    // Move the optical centre into the safe rectangle, preserving the fitted angle.
    camera.setViewOffset(width, height, width / 2 - (left + right) / 2,
      height / 2 - (top + bottom) / 2, width, height);
    camera.updateMatrixWorld();
  };
}
