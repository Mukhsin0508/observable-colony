import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Ant, ColonySnapshot, NestNode, Tunnel, UIState, Vec3, ViewMode } from './types';
import type { LifecycleSnapshot } from './lifecycle';
import { BiologyView } from './biology';
import { MeasuredView } from './measured-view';
import type { MeasuredStudy } from './study';

const vector = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, p.z);
const UP = new THREE.Vector3(0, 0, 1);
const BODY_COUNT = 3;
const ANT_LIMIT = 160;

/** A renderer only: biological decisions belong to the simulation. */
export class ColonyScene {
  readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly terrain = new THREE.Group();
  private readonly biology = new BiologyView();
  private measured: MeasuredView | null = null;
  private measuredEnabled = false;
  private readonly camera = new THREE.PerspectiveCamera(41, 1, 0.05, 140);
  private readonly controls: OrbitControls;
  private readonly nest = new THREE.Group();
  private readonly signalGroup = new THREE.Group();
  private readonly tunnels = new Map<number, { group: THREE.Group; curve: THREE.CatmullRomCurve3; progress: number; signal: THREE.Mesh<THREE.TubeGeometry, THREE.MeshBasicMaterial> }>();
  private readonly chambers = new Map<number, THREE.Group>();
  private readonly dummy = new THREE.Object3D();
  private readonly ants: THREE.InstancedMesh;
  private readonly cargo: THREE.InstancedMesh;
  private readonly legs: THREE.LineSegments;
  private readonly legPositions = new Float32Array(ANT_LIMIT * 32 * 3);
  private readonly contactPoints: THREE.Points;
  private readonly contacts = new Float32Array(ANT_LIMIT * 3);
  private readonly food = new THREE.Group();
  private readonly selection: THREE.Mesh;
  private readonly antLight = new THREE.PointLight(0xf8dca9, 5, 12);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly soilMaterial: THREE.MeshStandardMaterial;
  private readonly chamberMaterial: THREE.MeshStandardMaterial;
  private readonly rimMaterial = new THREE.MeshStandardMaterial({ color: 0x715136, roughness: 1 });
  private readonly labels: HTMLElement[] = [];
  private readonly surfaceTrail: THREE.Points;
  private readonly trailPositions = new Float32Array(2000 * 3);
  private readonly trailColors = new Float32Array(2000 * 3);
  private readonly resizeObserver: ResizeObserver;
  private mode: ViewMode = 'cutaway';
  private snapshot: ColonySnapshot | null = null;
  private transition = 1;
  private readonly targetPosition = new THREE.Vector3();
  private readonly targetLook = new THREE.Vector3();
  private readonly followLook = new THREE.Vector3();
  private pointerDown = { x: 0, y: 0 };
  private frame = 0;

  constructor(private readonly container: HTMLElement, private readonly onSelect: (id: number) => void) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.7));
    this.renderer.setClearColor(0x172b30, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.renderer.domElement.setAttribute('aria-label', '3D nest. Drag to rotate in Orbit view. Select an ant to follow it.');
    this.renderer.domElement.tabIndex = 0;
    container.append(this.renderer.domElement);
    this.scene.fog = new THREE.FogExp2(0x172b30, 0.012);
    this.scene.add(new THREE.HemisphereLight(0xe9f5ec, 0x4b3021, 2.8));
    const key = new THREE.DirectionalLight(0xffd7a0, 3.2);
    key.position.set(-8, 12, 12);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8bd8d4, 1.4);
    rim.position.set(10, 3, -4);
    this.scene.add(rim, this.nest, this.signalGroup, this.antLight, this.terrain, this.biology);

    const grain = this.makeSoilTexture();
    this.soilMaterial = new THREE.MeshStandardMaterial({ map: grain, color: 0x8a684b, roughness: 1, side: THREE.DoubleSide });
    this.chamberMaterial = new THREE.MeshStandardMaterial({ map: grain, color: 0x8e7256, roughness: 1, side: THREE.DoubleSide });
    this.makeTerrain(grain);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.07;
    this.controls.minDistance = 3;
    this.controls.maxDistance = 65;
    this.controls.maxPolarAngle = Math.PI * 0.87;
    this.controls.target.set(0, -5.5, 0);
    this.controls.enabled = false;
    this.camera.position.set(7, 1, 29);

    this.ants = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 14, 10), new THREE.MeshStandardMaterial({ color: 0x422719, roughness: 0.4, metalness: 0.1 }), ANT_LIMIT * BODY_COUNT);
    this.ants.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.ants.frustumCulled = false;
    this.scene.add(this.ants);
    this.cargo = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.09, 0), new THREE.MeshStandardMaterial({ color: 0xc8c297, roughness: 1 }), ANT_LIMIT);
    this.cargo.frustumCulled = false;
    this.scene.add(this.cargo);
    const legGeo = new THREE.BufferGeometry();
    legGeo.setAttribute('position', new THREE.BufferAttribute(this.legPositions, 3).setUsage(THREE.DynamicDrawUsage));
    this.legs = new THREE.LineSegments(legGeo, new THREE.LineBasicMaterial({ color: 0x8d613e, transparent: true, opacity: 1 }));
    this.legs.frustumCulled = false;
    this.scene.add(this.legs);
    const contactGeo = new THREE.BufferGeometry();
    contactGeo.setAttribute('position', new THREE.BufferAttribute(this.contacts, 3).setUsage(THREE.DynamicDrawUsage));
    this.contactPoints = new THREE.Points(contactGeo, new THREE.PointsMaterial({ color: 0xa6f9dc, size: 0.14, transparent: true, opacity: 0.8, depthWrite: false }));
    this.contactPoints.frustumCulled = false;
    this.signalGroup.add(this.contactPoints);
    this.selection = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.32, 36), new THREE.MeshBasicMaterial({ color: 0xb6ffe3, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.85 }));
    this.selection.visible = false;
    this.scene.add(this.selection);
    for (let i = 0; i < 7; i++) {
      const seed = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xd3b36e : 0xa1b16e, roughness: 0.9 }));
      seed.scale.set(1.5, 0.6, 0.75);
      seed.position.set(Math.sin(i * 2) * 0.38, 0.05 + i * 0.03, Math.cos(i * 2) * 0.3);
      seed.rotation.z = i;
      this.food.add(seed);
    }
    this.scene.add(this.food);
    const trailGeo = new THREE.BufferGeometry();
    trailGeo.setAttribute('position', new THREE.BufferAttribute(this.trailPositions, 3));
    trailGeo.setAttribute('color', new THREE.BufferAttribute(this.trailColors, 3));
    this.surfaceTrail = new THREE.Points(trailGeo, new THREE.PointsMaterial({ vertexColors: true, size: 0.17, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.surfaceTrail.frustumCulled = false;
    this.signalGroup.add(this.surfaceTrail);
    this.makeLabels();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
    this.renderer.domElement.addEventListener('pointerdown', e => { this.pointerDown = { x: e.clientX, y: e.clientY }; });
    this.renderer.domElement.addEventListener('pointerup', e => this.pickAnt(e));
    this.renderer.domElement.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      container.dispatchEvent(new CustomEvent('scene-error', { detail: 'The 3D view was interrupted. Reload to restore the colony.' }));
    });
  }

  private makeSoilTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#967657'; ctx.fillRect(0, 0, 512, 512);
    let seed = 183;
    const random = (): number => { seed = (1664525 * seed + 1013904223) >>> 0; return seed / 4294967296; };
    for (let y = 0; y < 512; y += 2) {
      ctx.fillStyle = `rgba(28,18,14,${0.035 + Math.sin(y * 0.017) * 0.028})`;
      ctx.fillRect(0, y, 512, 2);
    }
    for (let i = 0; i < 42000; i++) {
      const light = random() > 0.7;
      ctx.fillStyle = light ? `rgba(255,231,193,${random() * 0.21})` : `rgba(23,16,11,${random() * 0.3})`;
      const s = random() * 2.3 + 0.4;
      ctx.fillRect(random() * 512, random() * 512, s, s);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(2, 2);
    return texture;
  }

  private makeTerrain(texture: THREE.Texture): void {
    const slab = new THREE.Mesh(new THREE.BoxGeometry(25, 14, 3), new THREE.MeshStandardMaterial({ map: texture, color: 0x594c3c, roughness: 1 }));
    slab.position.set(0, -6.5, -4.4);
    this.terrain.add(slab);
    // Thin geological layers give the cutaway a readable ground plane.
    for (let i = 0; i < 5; i++) {
      const layer = new THREE.Mesh(new THREE.BoxGeometry(25.02, 0.025, 3.02), new THREE.MeshStandardMaterial({ color: i % 2 ? 0x8a7458 : 0x4d4435, roughness: 1 }));
      layer.position.set(0, -1.5 - i * 2.5, -4.4);
      this.terrain.add(layer);
    }
    const surface = new THREE.Mesh(new THREE.BoxGeometry(25.2, 0.22, 6.5), new THREE.MeshStandardMaterial({ map: texture, color: 0x627563, roughness: 1 }));
    surface.position.set(0, 0.2, -2.6);
    this.terrain.add(surface);
    const grassGeometry = new THREE.BufferGeometry();
    const blades: number[] = [];
    for (let i = 0; i < 200; i++) {
      const x = Math.sin(i * 71.3) * 12.3, z = -2.2 + Math.cos(i * 23.9) * 2.6;
      if (Math.abs(x) < 0.85 && z > -1) continue;
      const h = 0.15 + (Math.sin(i * 19.1) + 1) * 0.22;
      blades.push(x, 0.31, z, x + Math.sin(i) * 0.2, 0.31 + h, z - 0.1);
    }
    grassGeometry.setAttribute('position', new THREE.Float32BufferAttribute(blades, 3));
    this.terrain.add(new THREE.LineSegments(grassGeometry, new THREE.LineBasicMaterial({ color: 0x8b9f76, transparent: true, opacity: 0.6 })));
    const dust = new Float32Array(260 * 3);
    for (let i = 0; i < 260; i++) { dust[i * 3] = Math.sin(i * 53.2) * 15; dust[i * 3 + 1] = Math.cos(i * 39.1) * 9 - 4; dust[i * 3 + 2] = Math.sin(i * 41.7) * 7 - 4; }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    this.terrain.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xafbba7, size: 0.025, transparent: true, opacity: 0.3, depthWrite: false })));
  }

  private makeLabels(): void {
    const holder = document.querySelector<HTMLElement>('#labels')!;
    for (const text of ['SURFACE / ENTRANCE', 'FIRST CHAMBER', 'EXCAVATION FRONT', 'FOOD SOURCE']) {
      const label = document.createElement('span');
      label.className = 'world-label'; label.textContent = text;
      holder.append(label); this.labels.push(label);
    }
  }

  private curveFor(tunnel: Tunnel, nodes: NestNode[]): THREE.CatmullRomCurve3 {
    const a = vector(nodes.find(n => n.id === tunnel.from)!.position);
    const b = vector(nodes.find(n => n.id === tunnel.to)!.position);
    const midpoint = a.clone().lerp(b, 0.5);
    // Centerline remains close to agent paths; no invented looping routes.
    return new THREE.CatmullRomCurve3([a, midpoint, b]);
  }

  private trough(curve: THREE.CatmullRomCurve3, progress: number, radius: number): THREE.BufferGeometry {
    const steps = 24, radial = 14;
    const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps * Math.max(0.025, progress), point = curve.getPoint(t), tangent = curve.getTangent(t);
      const side = new THREE.Vector3(-tangent.y, tangent.x, 0).normalize();
      if (side.lengthSq() < 0.1) side.set(1, 0, 0);
      for (let j = 0; j <= radial; j++) {
        const angle = Math.PI + j / radial * Math.PI;
        const p = point.clone().addScaledVector(side, Math.cos(angle) * radius);
        p.z += Math.sin(angle) * radius;
        positions.push(p.x, p.y, p.z); uvs.push(j / radial, t * 3);
        if (i < steps && j < radial) { const a = i * (radial + 1) + j, b = a + radial + 1; indices.push(a, b, a + 1, b, b + 1, a + 1); }
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices); g.computeVertexNormals();
    return g;
  }

  private syncNest(snapshot: ColonySnapshot): void {
    const ids = new Set(snapshot.tunnels.map(t => t.id));
    for (const [id, object] of this.tunnels) {
      if (!ids.has(id)) { this.disposeGroup(object.group); object.signal.geometry.dispose(); object.signal.material.dispose(); this.signalGroup.remove(object.signal); this.tunnels.delete(id); }
    }
    for (const tunnel of snapshot.tunnels) {
      let existing = this.tunnels.get(tunnel.id);
      const curve = this.curveFor(tunnel, snapshot.nodes);
      if (existing && existing.curve.getPoint(1).distanceTo(curve.getPoint(1)) > 0.01) {
        this.disposeGroup(existing.group); existing.signal.geometry.dispose(); existing.signal.material.dispose(); this.signalGroup.remove(existing.signal); this.tunnels.delete(tunnel.id); existing = undefined;
      }
      if (!existing) {
        const group = new THREE.Group();
        const shell = new THREE.Mesh(this.trough(curve, tunnel.progress, 0.38), this.soilMaterial);
        group.add(shell);
        this.nest.add(group);
        const signal = new THREE.Mesh(new THREE.TubeGeometry(curve, 32, 0.038, 5, false), new THREE.MeshBasicMaterial({ color: 0x78e9b8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
        this.signalGroup.add(signal);
        existing = { group, curve, progress: tunnel.progress, signal };
        this.tunnels.set(tunnel.id, existing);
      }
      if (Math.abs(existing.progress - tunnel.progress) > 0.025 || (tunnel.progress === 1 && existing.progress !== 1)) {
        const shell = existing.group.children[0] as THREE.Mesh;
        shell.geometry.dispose(); shell.geometry = this.trough(existing.curve, tunnel.progress, 0.38);
        existing.progress = tunnel.progress;
      }
      existing.signal.visible = tunnel.progress >= 1;
      existing.signal.material.opacity = Math.min(0.9, Math.max(0, tunnel.pheromone * 0.85));
    }
    const visibleNodes = snapshot.nodes.filter(n => n.kind !== 'entrance' && snapshot.tunnels.some(t => t.to === n.id && t.progress > 0.98));
    const nodeIds = new Set(visibleNodes.map(n => n.id));
    for (const [id, group] of this.chambers) if (!nodeIds.has(id)) { this.disposeGroup(group); this.chambers.delete(id); }
    for (const node of visibleNodes) {
      const old = this.chambers.get(node.id);
      if (old) { old.position.copy(vector(node.position)); continue; }
      const group = new THREE.Group();
      const radius = Math.max(0.48, Math.min(1.4, node.radius));
      const bowl = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 18, Math.PI, Math.PI), this.chamberMaterial);
      bowl.scale.set(1.3, 0.72, 0.8);
      group.add(bowl);
      const lip = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.055, 5, 48), this.rimMaterial);
      lip.scale.set(1.3, 0.72, 1); group.add(lip);
      group.position.copy(vector(node.position)); this.nest.add(group); this.chambers.set(node.id, group);
    }
  }

  private drawAnts(ants: Ant[], time: number, selected: number | null, signals: boolean): void {
    let cargoCount = 0, contactCount = 0, lineOffset = 0;
    const count = Math.min(ants.length, ANT_LIMIT);
    this.ants.count = count * BODY_COUNT;
    for (let i = 0; i < count; i++) {
      const ant = ants[i], p = vector(ant.position).add(new THREE.Vector3(0, 0, 0.1));
      const direction = vector(ant.heading).normalize();
      if (direction.lengthSq() < 0.1) direction.set(0, -1, 0);
      const side = new THREE.Vector3().crossVectors(direction, UP).normalize();
      const angle = Math.atan2(direction.y, direction.x);
      const offsets = [0.12, 0, -0.15];
      const scales = [[0.085, 0.075, 0.065], [0.07, 0.05, 0.05], [0.12, 0.085, 0.07]];
      for (let k = 0; k < BODY_COUNT; k++) {
        this.dummy.position.copy(p).addScaledVector(direction, offsets[k]);
        this.dummy.rotation.set(0, 0, angle);
        this.dummy.scale.set(scales[k][0], scales[k][1], scales[k][2]);
        this.dummy.updateMatrix(); this.ants.setMatrixAt(i * BODY_COUNT + k, this.dummy.matrix);
      }
      for (let j = 0; j < 6; j++) {
        const sign = j % 2 === 0 ? -1 : 1, row = Math.floor(j / 2) - 1;
        const gait = Math.sin(time * 19 + i * 2 + j * Math.PI) * 0.035;
        const base = p.clone().addScaledVector(direction, row * 0.06);
        const knee = base.clone().addScaledVector(side, sign * 0.11).addScaledVector(direction, row * 0.055 + gait);
        knee.z += 0.035;
        const end = base.clone().addScaledVector(side, sign * (0.18 + Math.abs(row) * 0.015)).addScaledVector(direction, row * 0.09 + gait);
        end.z -= 0.055;
        this.legPositions.set([base.x, base.y, base.z, knee.x, knee.y, knee.z, knee.x, knee.y, knee.z, end.x, end.y, end.z], lineOffset); lineOffset += 12;
      }
      for (const sign of [-1, 1]) {
        const base = p.clone().addScaledVector(direction, 0.18).addScaledVector(side, sign * 0.035);
        const elbow = base.clone().addScaledVector(direction, 0.09).addScaledVector(side, sign * 0.075);
        const tip = elbow.clone().addScaledVector(direction, 0.08).addScaledVector(side, -sign * 0.025);
        this.legPositions.set([base.x, base.y, base.z, elbow.x, elbow.y, elbow.z, elbow.x, elbow.y, elbow.z, tip.x, tip.y, tip.z], lineOffset); lineOffset += 12;
      }
      if (ant.carrying) {
        this.dummy.position.copy(p).addScaledVector(direction, 0.25); this.dummy.rotation.set(0, 0, angle); this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix(); this.cargo.setMatrixAt(cargoCount++, this.dummy.matrix);
      }
      if (signals && ant.state === 'carrying food') { this.contacts.set([p.x, p.y, p.z + 0.13], contactCount++ * 3); }
      if (ant.id === selected) { this.selection.position.copy(p).add(new THREE.Vector3(0, 0, 0.15)); this.selection.quaternion.copy(this.camera.quaternion); }
    }
    this.selection.visible = selected !== null;
    this.ants.instanceMatrix.needsUpdate = true;
    this.cargo.count = cargoCount; this.cargo.instanceMatrix.needsUpdate = true;
    this.legs.geometry.setDrawRange(0, lineOffset / 3); this.legs.geometry.attributes.position.needsUpdate = true;
    this.contactPoints.geometry.setDrawRange(0, contactCount); this.contactPoints.geometry.attributes.position.needsUpdate = true;
  }

  update(snapshot: ColonySnapshot, state: UIState, delta: number, life?: LifecycleSnapshot): void {
    if (this.measuredEnabled) { this.updateMeasured(state, delta); return; }
    this.snapshot = snapshot;
    this.biology.visible = Boolean(life);
    if (life) {
      this.biology.position.copy(vector(snapshot.nodes[1]?.position ?? { x: 0, y: -2.3, z: 0 }));
      this.biology.update(life);
    }
    if (this.frame++ % 5 === 0) this.syncNest(snapshot);
    this.drawAnts(snapshot.ants, snapshot.stats.elapsed, state.selectedAnt, state.signals);
    this.signalGroup.visible = state.signals;
    this.food.position.copy(vector(snapshot.food));
    const trailCount = Math.min(snapshot.surfaceTrails.length, 2000);
    for (let i = 0; i < trailCount; i++) {
      const { position: p, intensity } = snapshot.surfaceTrails[i];
      this.trailPositions.set([p.x, p.y + 0.16, p.z], i * 3);
      const brightness = Math.sqrt(intensity);
      this.trailColors.set([0.28 * brightness, brightness, 0.65 * brightness], i * 3);
    }
    this.surfaceTrail.geometry.setDrawRange(0, trailCount);
    this.surfaceTrail.geometry.attributes.position.needsUpdate = true;
    this.surfaceTrail.geometry.attributes.color.needsUpdate = true;
    if (state.view !== this.mode) { this.mode = state.view; this.transition = 1; this.controls.enabled = state.view === 'orbit'; }
    const ant = snapshot.ants.find(a => a.id === state.selectedAnt);
    const mobile = this.container.clientWidth < 720;
    if (state.view === 'queen') {
      const p = this.biology.position.clone();
      this.targetPosition.copy(p).add(new THREE.Vector3(0.25, 0.55, mobile ? 6.6 : 4.9));
      this.targetLook.copy(p).add(new THREE.Vector3(mobile ? 0 : 0.15, mobile ? 0.75 : -0.1, 0));
      this.camera.position.lerp(this.targetPosition, 1 - Math.exp(-delta * 3.8));
      this.followLook.lerp(this.targetLook, 1 - Math.exp(-delta * 5));
      this.camera.lookAt(this.followLook);
      this.antLight.position.copy(p).add(new THREE.Vector3(0, 1, 2));
      this.antLight.intensity = 4;
    } else if (state.view === 'follow' && ant) {
      const p = vector(ant.position);
      this.targetPosition.copy(p).add(new THREE.Vector3(0.6, 0.7, 3));
      this.targetLook.copy(p).addScaledVector(vector(ant.heading), 0.3);
      this.camera.position.lerp(this.targetPosition, 1 - Math.exp(-delta * 3.8));
      this.followLook.lerp(this.targetLook, 1 - Math.exp(-delta * 5));
      this.camera.lookAt(this.followLook);
      this.antLight.position.copy(p).add(new THREE.Vector3(0, 1, 2));
      this.antLight.intensity = 3;
    } else if (state.view === 'cutaway' || this.transition > 0.01) {
      const availableWidth = mobile ? this.container.clientWidth - 24 : this.container.clientWidth - 305;
      const fitDistance = Math.max(27, this.container.clientHeight * 25 / (0.75 * availableWidth));
      this.targetPosition.set(mobile ? 2 : 7, mobile ? -1 : 1, fitDistance);
      this.targetLook.set(mobile ? 0 : -3.4, -5.7, -0.5);
      if (state.view === 'orbit') this.targetPosition.set(18, 5, 26);
      this.camera.position.lerp(this.targetPosition, 1 - Math.exp(-delta * 3));
      this.controls.target.lerp(this.targetLook, 1 - Math.exp(-delta * 3));
      this.camera.lookAt(this.controls.target);
      this.followLook.copy(this.controls.target);
      this.transition *= Math.exp(-delta * 3);
      this.antLight.intensity = 0;
    } else this.controls.update();
    this.updateLabels(snapshot, state.view);
    this.renderer.render(this.scene, this.camera);
  }

  showStudy(enabled: boolean, data: MeasuredStudy | null, index: number): void {
    if (enabled !== this.measuredEnabled) { this.transition = 1; this.mode = 'cutaway'; }
    this.measuredEnabled = enabled;
    for (const object of [this.terrain, this.nest, this.signalGroup, this.ants, this.cargo, this.legs, this.food, this.biology]) object.visible = !enabled;
    this.selection.visible = false;
    this.labels.forEach(label => { if (enabled) label.style.display = 'none'; });
    if (data && !this.measured) { this.measured = new MeasuredView(data); this.scene.add(this.measured); }
    if (this.measured) { this.measured.visible = enabled; this.measured.setFrame(index); }
  }

  private updateMeasured(state: UIState, delta: number): void {
    const orbit = state.view === 'orbit';
    if (this.mode !== state.view) { this.mode = state.view; this.transition = 1; }
    this.controls.enabled = orbit;
    this.antLight.intensity = 0;
    if (!orbit || this.transition > 0.01) {
      const mobile = this.container.clientWidth < 720;
      const distance = mobile ? 43 : Math.max(23, this.container.clientHeight * 18 / (0.75 * (this.container.clientWidth - 250)));
      this.targetPosition.set(orbit ? 13 : 4, 1, distance);
      this.targetLook.set(mobile ? 0 : 1, -5, 0);
      this.camera.position.lerp(this.targetPosition, 1 - Math.exp(-delta * 4));
      this.controls.target.lerp(this.targetLook, 1 - Math.exp(-delta * 4));
      this.camera.lookAt(this.controls.target);
      this.transition *= Math.exp(-delta * 4);
    } else this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }

  private updateLabels(snapshot: ColonySnapshot, view: ViewMode): void {
    const frontier = snapshot.tunnels.find(t => t.progress < 0.95);
    const lastNode = frontier ? snapshot.nodes.find(n => n.id === frontier.to) : snapshot.nodes.at(-1);
    const points = [new THREE.Vector3(0, 1.1, 0), vector(snapshot.nodes[1]?.position ?? { x: 0, y: -2, z: 0 }).add(new THREE.Vector3(1.5, 0, 0)), vector(lastNode?.position ?? { x: 0, y: -6, z: 0 }).add(new THREE.Vector3(0.5, -0.7, 0)), vector(snapshot.food).add(new THREE.Vector3(0, 0.75, 0))];
    points.forEach((point, i) => {
      point.project(this.camera);
      const label = this.labels[i];
      label.style.display = view === 'follow' || view === 'queen' || point.z > 1 || (this.container.clientWidth < 720 && i === 1) ? 'none' : 'block';
      label.style.transform = `translate(${(point.x * 0.5 + 0.5) * this.container.clientWidth}px,${(-point.y * 0.5 + 0.5) * this.container.clientHeight}px)`;
    });
  }

  private pickAnt(event: PointerEvent): void {
    if (Math.hypot(event.clientX - this.pointerDown.x, event.clientY - this.pointerDown.y) > 5) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObject(this.ants)[0];
    if (hit?.instanceId !== undefined && this.snapshot) {
      const ant = this.snapshot.ants[Math.floor(hit.instanceId / BODY_COUNT)];
      if (ant) this.onSelect(ant.id);
    }
  }

  private resize(): void {
    const { clientWidth: width, clientHeight: height } = this.container;
    this.renderer.setSize(width, height);
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.transition = 1;
  }

  private disposeGroup(group: THREE.Group): void {
    group.traverse(child => { if (child instanceof THREE.Mesh) child.geometry.dispose(); });
    this.nest.remove(group);
  }

  dispose(): void {
    this.resizeObserver.disconnect(); this.controls.dispose();
    this.scene.traverse(child => { if (child instanceof THREE.Mesh || child instanceof THREE.Line || child instanceof THREE.Points) { child.geometry.dispose(); const materials = Array.isArray(child.material) ? child.material : [child.material]; materials.forEach(m => m.dispose()); } });
    this.renderer.dispose();
  }
}
