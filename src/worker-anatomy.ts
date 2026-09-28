import * as THREE from 'three';
import type { Ant } from './types';

export const WORKER_BODY_PARTS = 5;
const LIMIT = 160;
const LIMB_PARTS = 24;
const CYLINDER_UP = new THREE.Vector3(0, 1, 0);

/** Stylized anatomy, not morphology reconstructed from the excavation scan. */
export class WorkerAnatomy extends THREE.Group {
  readonly bodies = new THREE.InstancedMesh(
    new THREE.SphereGeometry(1, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x77412b, roughness: 0.32, metalness: 0.08 }),
    LIMIT * WORKER_BODY_PARTS,
  );
  private readonly eyes = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshStandardMaterial({ color: 0x151a15, roughness: 0.16 }), LIMIT * 2);
  private readonly limbs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.66, 1, 1, 6), new THREE.MeshStandardMaterial({ color: 0xa0693c, roughness: 0.48 }), LIMIT * LIMB_PARTS);
  private readonly cargo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.085, 1), new THREE.MeshStandardMaterial({ color: 0xd3be86, roughness: 1 }), LIMIT);
  private readonly dummy = new THREE.Object3D();
  private readonly basis = new THREE.Matrix4();
  private readonly forward = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly normal = new THREE.Vector3();
  private readonly origin = new THREE.Vector3();
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly segmentDirection = new THREE.Vector3();

  constructor() {
    super();
    for (const mesh of [this.bodies, this.eyes, this.limbs, this.cargo]) {
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.add(mesh);
    }
  }

  private localPoint(target: THREE.Vector3, x: number, y: number, z: number): THREE.Vector3 {
    return target.copy(this.origin).addScaledVector(this.forward, x).addScaledVector(this.side, y).addScaledVector(this.normal, z);
  }

  private segment(index: number, a: [number, number, number], b: [number, number, number], radius: number): void {
    this.localPoint(this.start, ...a); this.localPoint(this.end, ...b);
    this.segmentDirection.subVectors(this.end, this.start);
    const length = this.segmentDirection.length();
    this.dummy.position.copy(this.start).lerp(this.end, 0.5);
    this.dummy.quaternion.setFromUnitVectors(CYLINDER_UP, this.segmentDirection.multiplyScalar(1 / Math.max(length, 0.0001)));
    this.dummy.scale.set(radius, length, radius);
    this.dummy.updateMatrix(); this.limbs.setMatrixAt(index, this.dummy.matrix);
  }

  /** All motion uses the simulation clock, so pause and replay freeze the same pose. */
  update(ants: Ant[], elapsed: number, selected: number | null): THREE.Vector3 | null {
    const count = Math.min(LIMIT, ants.length);
    let limbCount = 0, cargoCount = 0, selection: THREE.Vector3 | null = null;
    this.bodies.count = count * WORKER_BODY_PARTS;
    this.eyes.count = count * 2;
    const parts = [
      { x: 0.135, scale: [0.1, 0.079, 0.079] },
      { x: -0.008, scale: [0.094, 0.058, 0.066] },
      { x: -0.112, scale: [0.035, 0.033, 0.042] },
      { x: -0.165, scale: [0.037, 0.041, 0.04] },
      { x: -0.29, scale: [0.139, 0.098, 0.086] },
    ];
    for (let i = 0; i < count; i++) {
      const ant = ants[i], surface = ant.position.y >= 0.05;
      this.forward.set(ant.heading.x, ant.heading.y, ant.heading.z);
      if (this.forward.lengthSq() < 0.001) this.forward.set(1, 0, 0);
      this.forward.normalize();
      this.normal.set(0, surface ? 1 : 0, surface ? 0 : 1);
      this.side.crossVectors(this.normal, this.forward);
      if (this.side.lengthSq() < 0.01) this.side.set(1, 0, 0);
      this.side.normalize(); this.normal.crossVectors(this.forward, this.side).normalize();
      this.origin.set(ant.position.x, ant.position.y, ant.position.z).addScaledVector(this.normal, surface ? 0.19 : 0.13);
      this.basis.makeBasis(this.forward, this.side, this.normal);
      const orientation = new THREE.Quaternion().setFromRotationMatrix(this.basis);
      for (let k = 0; k < WORKER_BODY_PARTS; k++) {
        const part = parts[k];
        this.localPoint(this.dummy.position, part.x, 0, k === 2 ? 0.012 : 0);
        this.dummy.quaternion.copy(orientation);
        this.dummy.scale.set(part.scale[0], part.scale[1], part.scale[2]);
        this.dummy.updateMatrix(); this.bodies.setMatrixAt(i * WORKER_BODY_PARTS + k, this.dummy.matrix);
      }
      for (let j = 0; j < 2; j++) {
        this.localPoint(this.dummy.position, 0.155, (j ? 1 : -1) * 0.067, 0.035);
        this.dummy.quaternion.copy(orientation); this.dummy.scale.set(0.027, 0.018, 0.028);
        this.dummy.updateMatrix(); this.eyes.setMatrixAt(i * 2 + j, this.dummy.matrix);
      }
      const amplitude = ant.state === 'digging' || ant.state === 'tending brood' ? 0.008 : 0.044;
      for (const sign of [-1, 1]) {
        for (let row = -1; row <= 1; row++) {
          const phase = elapsed * 13 + ant.id * 1.47 + (row === 0 ? Math.PI : 0) + (sign < 0 ? Math.PI : 0);
          const stride = Math.sin(phase) * amplitude;
          const lift = Math.max(0, Math.cos(phase)) * amplitude * 0.58;
          const base: [number, number, number] = [row * 0.045 - 0.012, sign * 0.032, -0.005];
          const knee: [number, number, number] = [row * 0.11 + stride * 0.5, sign * 0.143, -0.006];
          const ankle: [number, number, number] = [row * 0.183 + stride, sign * (0.211 + Math.abs(row) * 0.015), -0.116 + lift];
          const toe: [number, number, number] = [ankle[0] + 0.037, ankle[1] + sign * 0.018, -0.13 + lift];
          this.segment(limbCount++, base, knee, 0.014);
          this.segment(limbCount++, knee, ankle, 0.01);
          this.segment(limbCount++, ankle, toe, 0.006);
        }
        const sweep = Math.sin(elapsed * 2.2 + ant.id + sign) * 0.027;
        const elbow: [number, number, number] = [0.293, sign * (0.135 + sweep), 0.045];
        this.segment(limbCount++, [0.207, sign * 0.041, 0.012], elbow, 0.009);
        this.segment(limbCount++, elbow, [0.393, sign * (0.11 + sweep * 1.5), 0.012], 0.006);
        this.segment(limbCount++, [0.21, sign * 0.041, -0.018], [0.263, sign * 0.013, -0.033], 0.015);
      }
      if (ant.carrying) {
        this.localPoint(this.dummy.position, 0.288, 0, -0.028);
        this.dummy.quaternion.copy(orientation); this.dummy.scale.set(1.18, 0.8, 0.9);
        this.dummy.updateMatrix(); this.cargo.setMatrixAt(cargoCount++, this.dummy.matrix);
      }
      if (ant.id === selected) selection = this.origin.clone().addScaledVector(this.normal, 0.17);
    }
    this.limbs.count = limbCount; this.cargo.count = cargoCount;
    for (const mesh of [this.bodies, this.eyes, this.limbs, this.cargo]) mesh.instanceMatrix.needsUpdate = true;
    // InstancedMesh otherwise retains a stale sphere after workers move or are born.
    this.bodies.boundingSphere = null;
    return selection;
  }
}
