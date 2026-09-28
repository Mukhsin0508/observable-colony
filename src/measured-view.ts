import * as THREE from 'three';
import type { MeasuredStudy } from './study';

/** Displays recorded grain coordinates, with a documented affine display transform. */
export class MeasuredView extends THREE.Group {
  private readonly measured: THREE.InstancedMesh;
  private readonly remaining: THREE.Points;
  private readonly dummy = new THREE.Object3D();
  private readonly normalized: THREE.Vector3[];
  private currentIndex = -1;

  constructor(readonly data: MeasuredStudy) {
    super();
    const bounds = new THREE.Box3();
    for (const [, x, y, z] of data.points) bounds.expandByPoint(new THREE.Vector3(x, y, z));
    const center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    const scale = 12 / Math.max(size.x, size.y, size.z, 0.001);
    // Preserve relative positions; laboratory z becomes the vertical display axis.
    this.normalized = data.points.map(([, x, y, z]) => new THREE.Vector3((x - center.x) * scale, (z - center.z) * scale - 5, (y - center.y) * scale));
    this.measured = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.055, 1), new THREE.MeshStandardMaterial({ color: 0x86dbc4, roughness: 0.48, emissive: 0x265448, emissiveIntensity: 0.22 }), data.points.length);
    this.measured.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.measured.frustumCulled = false;
    this.add(this.measured);
    const geometry = new THREE.BufferGeometry().setFromPoints(this.normalized);
    this.remaining = new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x7e9691, size: 0.035, transparent: true, opacity: 0.2, depthWrite: false }));
    this.add(this.remaining);
    const box = new THREE.Box3().setFromPoints(this.normalized).expandByScalar(0.5);
    this.add(new THREE.Box3Helper(box, 0x3a6661));
    const grid = new THREE.GridHelper(18, 18, 0x416d63, 0x244741);
    grid.position.y = box.min.y - 0.25; this.add(grid);
    this.setFrame(0);
  }

  setFrame(index: number): void {
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    const frame = this.data.frames[index];
    if (!frame) return;
    let count = 0;
    this.data.points.forEach((point, i) => {
      if (point[4] < 0 || point[4] > frame.scan) return;
      this.dummy.position.copy(this.normalized[i]); this.dummy.scale.setScalar(point[4] === frame.scan ? 1.35 : 1); this.dummy.updateMatrix();
      this.measured.setMatrixAt(count, this.dummy.matrix);
      this.measured.setColorAt(count, new THREE.Color(point[4] === frame.scan ? 0xffdb93 : 0x85dbc7));
      count++;
    });
    this.measured.count = count;
    this.measured.instanceMatrix.needsUpdate = true;
    if (this.measured.instanceColor) this.measured.instanceColor.needsUpdate = true;
  }
}
