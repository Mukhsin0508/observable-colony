import * as THREE from 'three';
import { excavationExtent, type MeasuredStudy } from './study';
import { formatMillimetres } from './journey-ui';

export interface DimensionLabel { text: string; position: THREE.Vector3; align: 'center' | 'left'; }

const DIMENSION_OFFSET = 0.75;
const TICK = 0.28;

/** Displays recorded grain coordinates, with a documented affine display transform. */
export class MeasuredView extends THREE.Group {
  private readonly measured: THREE.InstancedMesh;
  private readonly remaining: THREE.Points;
  private readonly dummy = new THREE.Object3D();
  private readonly normalized: THREE.Vector3[];
  private readonly center: THREE.Vector3;
  private readonly displayScale: number;
  private readonly dimensionPositions = new Float32Array(9 * 2 * 3);
  private readonly dimensions: THREE.LineSegments;
  private readonly labels: DimensionLabel[] = [
    { text: '', position: new THREE.Vector3(), align: 'left' },
    { text: '', position: new THREE.Vector3(), align: 'center' },
    { text: '', position: new THREE.Vector3(), align: 'center' },
  ];
  private hasExtent = false;
  private dimensionsEnabled = true;
  private currentIndex = -1;

  constructor(readonly data: MeasuredStudy) {
    super();
    const bounds = new THREE.Box3();
    for (const [, x, y, z] of data.points) bounds.expandByPoint(new THREE.Vector3(x, y, z));
    this.center = bounds.getCenter(new THREE.Vector3());
    const size = bounds.getSize(new THREE.Vector3());
    this.displayScale = 12 / Math.max(size.x, size.y, size.z, 0.001);
    // Preserve relative positions; laboratory z becomes the vertical display axis.
    this.normalized = data.points.map(([, x, y, z]) => this.toDisplay(x, y, z, new THREE.Vector3()));
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
    const dimensionGeometry = new THREE.BufferGeometry();
    dimensionGeometry.setAttribute('position', new THREE.BufferAttribute(this.dimensionPositions, 3).setUsage(THREE.DynamicDrawUsage));
    // Annotation lines stay readable over the grains; they mark measured spans, not tunnel walls.
    this.dimensions = new THREE.LineSegments(dimensionGeometry, new THREE.LineBasicMaterial({ color: 0xe0c393, transparent: true, opacity: 0.9, depthTest: false }));
    this.dimensions.renderOrder = 10; this.dimensions.frustumCulled = false; this.dimensions.visible = false;
    this.add(this.dimensions);
    this.setFrame(0);
  }

  private toDisplay(x: number, y: number, z: number, target: THREE.Vector3): THREE.Vector3 {
    return target.set((x - this.center.x) * this.displayScale, (z - this.center.z) * this.displayScale - 5, (y - this.center.y) * this.displayScale);
  }

  /** Screen labels for the height, width and depth lines, in this group's local space. */
  dimensionLabels(): readonly DimensionLabel[] { return this.hasExtent && this.dimensionsEnabled ? this.labels : []; }

  /** Narrow screens keep the numbers in the panel and hide the in-scene gauge. */
  setDimensionsEnabled(enabled: boolean): void {
    this.dimensionsEnabled = enabled;
    this.dimensions.visible = enabled && this.hasExtent;
  }

  setFrame(index: number): void {
    if (index === this.currentIndex) return;
    this.currentIndex = index;
    const frame = this.data.frames[index];
    if (!frame) return;
    let count = 0;
    const current = new THREE.Color(0xffdb93), earlier = new THREE.Color(0x85dbc7);
    this.data.points.forEach((point, i) => {
      if (point[4] < 0 || point[4] > frame.scan) return;
      this.dummy.position.copy(this.normalized[i]); this.dummy.scale.setScalar(point[4] === frame.scan ? 1.35 : 1); this.dummy.updateMatrix();
      this.measured.setMatrixAt(count, this.dummy.matrix);
      this.measured.setColorAt(count, point[4] === frame.scan ? current : earlier);
      count++;
    });
    this.measured.count = count;
    this.measured.instanceMatrix.needsUpdate = true;
    if (this.measured.instanceColor) this.measured.instanceColor.needsUpdate = true;
    this.updateDimensions(frame.scan);
  }

  private updateDimensions(scan: number): void {
    const extent = excavationExtent(this.data, scan);
    this.hasExtent = extent !== null;
    this.dimensions.visible = this.hasExtent && this.dimensionsEnabled;
    if (!extent) return;
    const low = this.toDisplay(extent.min[0], extent.min[1], extent.min[2], new THREE.Vector3());
    const high = this.toDisplay(extent.max[0], extent.max[1], extent.max[2], new THREE.Vector3());
    // Width and depth run along the soil surface; height hangs from it like a depth gauge,
    // on the camera-facing (+x, +z) edges of the excavated span's bounding box.
    const x = high.x + DIMENSION_OFFSET, z = high.z + DIMENSION_OFFSET, y = high.y + DIMENSION_OFFSET;
    const segments: number[] = [
      x, low.y, z, x, high.y, z, x - TICK, low.y, z, x + TICK, low.y, z, x - TICK, high.y, z, x + TICK, high.y, z,
      low.x, y, z, high.x, y, z, low.x, y - TICK, z, low.x, y + TICK, z, high.x, y - TICK, z, high.x, y + TICK, z,
      x, y, low.z, x, y, high.z, x, y - TICK, low.z, x, y + TICK, low.z, x, y - TICK, high.z, x, y + TICK, high.z,
    ];
    this.dimensionPositions.set(segments);
    this.dimensions.geometry.attributes.position.needsUpdate = true;
    this.dimensions.geometry.computeBoundingSphere();
    this.labels[0].text = `HEIGHT ${formatMillimetres(extent.heightMm)}`;
    this.labels[0].position.set(x + 0.3, (low.y + high.y) / 2, z);
    this.labels[1].text = `WIDTH ${formatMillimetres(extent.widthMm)}`;
    this.labels[1].position.set((low.x + high.x) / 2, y + 0.5, z);
    this.labels[2].text = `DEPTH ${formatMillimetres(extent.depthMm)}`;
    this.labels[2].position.set(x + 0.3, y + 0.5, (low.z + high.z) / 2);
  }
}
