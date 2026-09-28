import * as THREE from 'three';
import type { LifecycleSnapshot } from './lifecycle';

const chitin = new THREE.MeshStandardMaterial({ color: 0x76432c, roughness: 0.3, metalness: 0.08 });
const dark = new THREE.MeshStandardMaterial({ color: 0x171e17, roughness: 0.16 });
const joint = new THREE.MeshStandardMaterial({ color: 0x9a6239, roughness: 0.5 });
const wingMaterial = new THREE.MeshPhysicalMaterial({ color: 0xd4ece1, transparent: true, opacity: 0.3, roughness: 0.35, side: THREE.DoubleSide, depthWrite: false });
const veinMaterial = new THREE.LineBasicMaterial({ color: 0x777c62, transparent: true, opacity: 0.45 });
const sphere = new THREE.SphereGeometry(1, 18, 14);
const cylinder = new THREE.CylinderGeometry(0.7, 1, 1, 6);
const vertical = new THREE.Vector3(0, 1, 0);
interface AntRig { group: THREE.Group; gaster: THREE.Mesh; antennae: THREE.Group[]; legs: THREE.Group[]; wings: THREE.Group[]; }

function ellipsoid(material: THREE.Material, size: [number, number, number], position: [number, number, number]): THREE.Mesh {
  const mesh = new THREE.Mesh(sphere, material);
  mesh.scale.set(...size); mesh.position.set(...position);
  return mesh;
}

function limb(start: THREE.Vector3, end: THREE.Vector3, thickness = 0.017): THREE.Mesh {
  const mesh = new THREE.Mesh(cylinder, joint);
  mesh.position.copy(start).lerp(end, 0.5);
  mesh.quaternion.setFromUnitVectors(vertical, end.clone().sub(start).normalize());
  mesh.scale.set(thickness, start.distanceTo(end), thickness);
  return mesh;
}

function makeAnt(winged = false): AntRig {
  const group = new THREE.Group();
  const gaster = ellipsoid(chitin, [0.27, 0.175, 0.15], [-0.3, 0, 0.07]);
  const rig: AntRig = { group, gaster, antennae: [], legs: [], wings: [] };
  group.add(gaster);
  group.add(ellipsoid(joint, [0.047, 0.07, 0.064], [-0.018, 0, 0.08]));
  group.add(ellipsoid(joint, [0.041, 0.056, 0.076], [0.055, 0, 0.09]));
  group.add(ellipsoid(chitin, [0.15, 0.12, 0.13], [0.22, 0, 0.1]));
  group.add(ellipsoid(chitin, [0.135, 0.13, 0.12], [0.47, 0, 0.1]));
  for (const sign of [-1, 1]) {
    group.add(ellipsoid(dark, [0.03, 0.032, 0.034], [0.5, sign * 0.11, 0.145]));
    group.add(limb(new THREE.Vector3(0.58, sign * 0.065, 0.08), new THREE.Vector3(0.66, sign * 0.025, 0.045), 0.025));
    const antenna = new THREE.Group();
    antenna.position.set(0.54, sign * 0.055, 0.13);
    const a = new THREE.Vector3(), b = new THREE.Vector3(0.13, sign * 0.16, 0.04), c = new THREE.Vector3(0.29, sign * 0.12, 0.015);
    antenna.add(limb(a, b, 0.015), limb(b, c, 0.01));
    group.add(antenna); rig.antennae.push(antenna);
    for (let row = -1; row <= 1; row++) {
      const leg = new THREE.Group(); leg.position.set(0.18 + row * 0.075, sign * 0.07, 0.075);
      const base = new THREE.Vector3(), knee = new THREE.Vector3(row * 0.12, sign * 0.19, 0.035);
      const ankle = new THREE.Vector3(row * 0.25, sign * 0.34, -0.075), foot = new THREE.Vector3(row * 0.25 + 0.065, sign * 0.375, -0.1);
      leg.add(limb(base, knee, 0.022), limb(knee, ankle, 0.015), limb(ankle, foot, 0.009));
      group.add(leg); rig.legs.push(leg);
    }
    if (winged) for (let pair = 0; pair < 2; pair++) {
      const wing = new THREE.Group(); wing.position.set(0.17 - pair * 0.055, sign * 0.07, 0.2);
      const length = pair ? 0.3 : 0.42;
      wing.add(ellipsoid(wingMaterial, [length, pair ? 0.105 : 0.135, 0.006], [-length * 0.68, sign * 0.13, 0]));
      const veins = new THREE.BufferGeometry();
      veins.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.009, -length * 1.55, sign * 0.15, 0.009, -length * 0.25, sign * 0.025, 0.009, -length, sign * 0.22, 0.009, -length * 0.65, sign * 0.06, 0.009, -length * 1.25, sign * 0.08, 0.009], 3));
      wing.add(new THREE.LineSegments(veins, veinMaterial));
      wing.rotation.z = -sign * (pair ? 0.68 : 0.35);
      group.add(wing); rig.wings.push(wing);
    }
  }
  return rig;
}

function animateAnt(rig: AntRig, time: number, phase: number, queen: boolean): void {
  rig.gaster.scale.z = 0.15 * (1 + Math.sin(time * 1.1 + phase) * 0.025);
  rig.antennae.forEach((antenna, i) => { antenna.rotation.z = Math.sin(time * 1.6 + phase + i * 1.8) * 0.11; antenna.rotation.y = Math.sin(time * 1.2 + phase + i) * 0.07; });
  rig.legs.forEach((leg, i) => { leg.rotation.z = Math.sin(time * (queen ? 0.8 : 1.4) + phase + i * 1.9) * 0.028; });
  rig.wings.forEach((wing, i) => { wing.rotation.x = (i < 2 ? -1 : 1) * (0.05 + Math.sin(time * 2.1 + phase) * 0.045); });
}

/** Illustrative anatomy tied to model cohorts; dimensions are not scan measurements. */
export class BiologyView extends THREE.Group {
  private readonly queenRig = makeAnt();
  readonly queen = this.queenRig.group;
  private readonly eggs: THREE.InstancedMesh;
  private readonly larvae: THREE.InstancedMesh;
  private readonly pupae: THREE.InstancedMesh;
  private readonly alates: AntRig[] = [];
  private readonly dummy = new THREE.Object3D();
  constructor() {
    super();
    this.queen.position.set(0.15, 0.12, 0.16);
    this.queen.scale.setScalar(0.9);
    this.queen.rotation.z = 0.25;
    this.add(this.queen);
    this.eggs = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xf0e8ce, roughness: 0.5 }), 36);
    this.larvae = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xe8dfbc, roughness: 0.52 }), 84);
    this.pupae = new THREE.InstancedMesh(sphere, new THREE.MeshStandardMaterial({ color: 0xd4b889, roughness: 0.65 }), 20);
    for (const mesh of [this.eggs, this.larvae, this.pupae]) { mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.add(mesh); }
    for (let i = 0; i < 7; i++) { const ant = makeAnt(true); ant.group.scale.setScalar(0.44); this.alates.push(ant); this.add(ant.group); }
  }

  update(life: LifecycleSnapshot, elapsed: number): void {
    this.queen.visible = life.queenAlive;
    this.queen.rotation.z = 0.25 + Math.sin(elapsed * 0.3) * 0.025;
    if (life.queenAlive) animateAnt(this.queenRig, elapsed, 0, true);
    this.placeBrood(this.eggs, Math.min(36, life.eggs), -0.55, 0.13, [0.035, 0.06, 0.032]);
    this.placeBrood(this.pupae, Math.min(20, life.pupae), 0.55, -0.32, [0.055, 0.11, 0.045]);
    const count = Math.min(12, life.larvae);
    this.larvae.count = count * 7;
    for (let i = 0; i < count; i++) for (let j = 0; j < 7; j++) {
      const curl = Math.sin(elapsed * 0.9 + i * 2.3) * 0.06;
      const angle = j / 6 * (1.4 + curl) - 0.7;
      const taper = 0.84 + Math.sin(j / 6 * Math.PI) * 0.16;
      this.dummy.position.set(-0.45 + (i % 4) * 0.16 + Math.cos(angle) * 0.06, -0.27 - Math.floor(i / 4) * 0.12 + Math.sin(angle) * 0.07, 0.035 + Math.sin(elapsed * 0.8 + i + j * 0.4) * 0.004);
      this.dummy.rotation.set(0, 0, angle); this.dummy.scale.set(0.039 * taper, 0.034 * taper, 0.027 * taper); this.dummy.updateMatrix();
      this.larvae.setMatrixAt(i * 7 + j, this.dummy.matrix);
    }
    this.larvae.instanceMatrix.needsUpdate = true;
    this.alates.forEach((rig, index) => {
      rig.group.visible = index < life.alates;
      rig.group.position.set(-0.8 + index * 0.24, -0.7 + Math.sin(index) * 0.13, 0.08);
      rig.group.rotation.z = index * 1.8 + Math.sin(elapsed * 0.2 + index) * 0.06;
      if (rig.group.visible) animateAnt(rig, elapsed, index * 2.3, false);
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
