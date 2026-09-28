import * as THREE from 'three';
import type { LifecycleSnapshot } from './lifecycle';

const chitin = new THREE.MeshStandardMaterial({ color: 0x623622, roughness: 0.31, metalness: 0.13 });
const dark = new THREE.MeshStandardMaterial({ color: 0x251b16, roughness: 0.24 });
const joint = new THREE.MeshStandardMaterial({ color: 0x824b2b, roughness: 0.55 });
const sphere = new THREE.SphereGeometry(1, 18, 14);

function ellipsoid(material: THREE.Material, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(sphere, material);
  mesh.scale.set(...size); mesh.position.set(...position);
  return mesh;
}

function limb(start: THREE.Vector3, end: THREE.Vector3, thickness = 0.017): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(thickness * 0.7, thickness, start.distanceTo(end), 6), joint);
  mesh.position.copy(start).lerp(end, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  return mesh;
}

function makeAnt(winged = false): THREE.Group {
  const ant = new THREE.Group();
  ant.add(ellipsoid(chitin, [0.25, 0.17, 0.14], [-0.23, 0, 0.06]));
  ant.add(ellipsoid(joint, [0.07, 0.055, 0.065], [0.03, 0, 0.055]));
  ant.add(ellipsoid(chitin, [0.16, 0.12, 0.12], [0.2, 0, 0.09]));
  ant.add(ellipsoid(chitin, [0.14, 0.135, 0.11], [0.44, 0, 0.09]));
  for (const sign of [-1, 1]) {
    ant.add(ellipsoid(dark, [0.027, 0.034, 0.026], [0.47, sign * 0.115, 0.13]));
    const a = new THREE.Vector3(0.51, sign * 0.07, 0.09);
    const b = new THREE.Vector3(0.64, sign * 0.19, 0.1);
    const c = new THREE.Vector3(0.8, sign * 0.16, 0.08);
    ant.add(limb(a, b, 0.012), limb(b, c, 0.009));
    for (let row = -1; row <= 1; row++) {
      const base = new THREE.Vector3(0.14 + row * 0.09, sign * 0.05, 0.06);
      const knee = new THREE.Vector3(base.x + row * 0.14, sign * 0.25, 0.12);
      const foot = new THREE.Vector3(base.x + row * 0.29, sign * 0.39, -0.025);
      ant.add(limb(base, knee), limb(knee, foot, 0.011));
    }
    if (winged) {
      const wing = ellipsoid(new THREE.MeshPhysicalMaterial({ color: 0xd4ece1, transparent: true, opacity: 0.27, roughness: 0.35, side: THREE.DoubleSide, depthWrite: false }), [0.38, 0.13, 0.008], [-0.04, sign * 0.25, 0.2]);
      wing.rotation.z = sign * -0.5; ant.add(wing);
    }
  }
  return ant;
}

/** Illustrative anatomy tied to model cohorts; dimensions are not scan measurements. */
export class BiologyView extends THREE.Group {
  readonly queen = makeAnt();
  private readonly eggs: THREE.InstancedMesh;
  private readonly larvae: THREE.InstancedMesh;
  private readonly pupae: THREE.InstancedMesh;
  private readonly alates: THREE.Group[] = [];
  private readonly dummy = new THREE.Object3D();
  constructor() {
    super();
    this.queen.position.set(0.15, 0.12, 0.16);
    this.queen.scale.setScalar(0.9);
    this.queen.rotation.z = 0.25;
    this.add(this.queen);
    this.eggs = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xf0e8ce, roughness: 0.5 }), 36);
    this.larvae = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xded4a8, roughness: 0.7 }), 84);
    this.pupae = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xcaa674, roughness: 0.85 }), 20);
    for (const mesh of [this.eggs, this.larvae, this.pupae]) { mesh.frustumCulled = false; this.add(mesh); }
    for (let i = 0; i < 7; i++) { const ant = makeAnt(true); ant.scale.setScalar(0.44); this.alates.push(ant); this.add(ant); }
  }

  update(life: LifecycleSnapshot): void {
    this.queen.visible = life.queenAlive;
    this.queen.rotation.z = 0.25 + Math.sin(life.day * 0.3) * 0.04;
    this.placeBrood(this.eggs, Math.min(36, life.eggs), -0.55, 0.13, [0.035, 0.06, 0.032]);
    this.placeBrood(this.pupae, Math.min(20, life.pupae), 0.55, -0.32, [0.055, 0.11, 0.045]);
    const count = Math.min(12, life.larvae);
    this.larvae.count = count * 7;
    for (let i = 0; i < count; i++) for (let j = 0; j < 7; j++) {
      const angle = j / 6 * 1.4 - 0.7;
      this.dummy.position.set(-0.45 + (i % 4) * 0.16 + Math.cos(angle) * 0.06, -0.27 - Math.floor(i / 4) * 0.12 + Math.sin(angle) * 0.07, 0.035);
      this.dummy.rotation.set(0, 0, 0); this.dummy.scale.set(0.039, 0.034, 0.027); this.dummy.updateMatrix();
      this.larvae.setMatrixAt(i * 7 + j, this.dummy.matrix);
    }
    this.larvae.instanceMatrix.needsUpdate = true;
    this.alates.forEach((ant, index) => {
      ant.visible = index < life.alates;
      ant.position.set(-0.8 + index * 0.24, -0.7 + Math.sin(index) * 0.13, 0.08);
      ant.rotation.z = index * 1.8 + Math.sin(life.day * 0.1) * 0.2;
    });
  }

  private placeBrood(mesh: THREE.InstancedMesh, count: number, x: number, y: number, size: [number, number, number]): void {
    mesh.count = count;
    for (let i = 0; i < count; i++) {
      this.dummy.position.set(x + (i % 6) * 0.07, y - Math.floor(i / 6) * 0.07, -0.035 + Math.sin(i * 4) * 0.012);
      this.dummy.rotation.set(0, 0, Math.sin(i * 2.4) * 0.6); this.dummy.scale.set(...size); this.dummy.updateMatrix(); mesh.setMatrixAt(i, this.dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }
}
