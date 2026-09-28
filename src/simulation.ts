import type { Ant, ColonySnapshot, NestNode, SurfaceTrail, Tunnel, Vec3 } from './types';

type Waypoint = { position: Vec3; nodeId: number | null; tunnelId: number | null };
type Task = 'wandering' | 'approaching dig' | 'digging' | 'returning soil' | 'outbound' | 'returning food' | 'nursing' | 'surface search' | 'surface return';
type Brain = { nodeId: number; previousNode: number; task: Task; route: Waypoint[]; digId: number | null; workLeft: number; rest: number; speed: number; surfaceAngle: number; searchTimer: number };
const TICK = 0.05;
const MAX_TUNNELS = 40;
const FIELD_SPACING = 0.3;
const FIELD_COLUMNS = 69;
const FIELD_ROWS = 15;
const FIELD_X_MIN = -10.2;
const FIELD_Z_MIN = -2.1;
const copy = (v: Vec3): Vec3 => ({ ...v });
const distance = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
const interpolate = (a: Vec3, b: Vec3, t: number): Vec3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: a.z + (b.z - a.z) * t });

/** An explanatory model. Local excavation choices and a decaying trail are not a biological calibration. */
export class ColonySimulation {
  private seed = 1;
  private randomState = 1;
  private accumulator = 0;
  private elapsed = 0;
  private foodCollected = 0;
  private contacts = 0;
  private contactClock = 0;
  private contactCooldowns = new Map<string, number>();
  private nodes: NestNode[] = [];
  private tunnels: Tunnel[] = [];
  private ants: Ant[] = [];
  private brains: Brain[] = [];
  private food: Vec3 = { x: 8, y: 0.25, z: 0 };
  private events: string[] = [];
  private surfaceField = new Float64Array(FIELD_COLUMNS * FIELD_ROWS);

  constructor(seed = 1709) { this.reset(seed); }

  reset(seed = this.seed): void {
    this.seed = seed >>> 0;
    this.randomState = this.seed;
    this.accumulator = 0;
    this.elapsed = 0;
    this.foodCollected = 0;
    this.contacts = 0;
    this.contactClock = 0;
    this.contactCooldowns.clear();
    this.surfaceField.fill(0);
    this.food = { x: 8, y: 0.25, z: 0 };
    this.nodes = [
      { id: 0, position: { x: 0, y: 0, z: 0 }, radius: 0.38, kind: 'entrance' },
      { id: 1, position: { x: 0, y: -2.3, z: 0 }, radius: 0.8, kind: 'chamber' },
      { id: 2, position: { x: -2.3, y: -4.1, z: 0.35 }, radius: 0.52, kind: 'chamber' },
      { id: 3, position: { x: 2.5, y: -4.5, z: -0.4 }, radius: 0.55, kind: 'chamber' },
      { id: 4, position: { x: -4.4, y: -5.7, z: 0.1 }, radius: 0.47, kind: 'junction' },
      { id: 5, position: { x: 4.1, y: -6.3, z: 0.3 }, radius: 0.47, kind: 'junction' },
    ];
    this.tunnels = [[0, 1, 1], [1, 2, 1], [1, 3, 1], [2, 4, 0.12], [3, 5, 0.1]].map(([from, to, progress], id) => ({ id, from: from!, to: to!, progress: progress!, pheromone: 0, traffic: 0 }));
    this.ants = [];
    this.brains = [];
    this.events = ['Workers explore the starter nest.'];
    for (let id = 0; id < 65; id++) {
      const role = id < 30 ? 'excavator' : id < 55 ? 'forager' : 'nurse';
      const edge = this.tunnels[id % 3]!;
      const start = interpolate(this.node(edge.from).position, this.node(edge.to).position, this.random());
      const ant: Ant = { id, role, state: role === 'forager' ? 'seeking food' : role === 'nurse' ? 'tending brood' : 'exploring', position: start, heading: { x: 0, y: 1, z: 0 }, carrying: false, tunnelId: edge.id };
      this.ants.push(ant);
      const brain: Brain = { nodeId: edge.to, previousNode: edge.from, task: role === 'forager' ? 'outbound' : role === 'nurse' ? 'nursing' : 'wandering', route: [this.waypoint(edge.to, edge.id)], digId: null, workLeft: 0, rest: 0, speed: 0.8 + this.random() * 0.45, surfaceAngle: (this.random() < 0.5 ? 0 : Math.PI) + (this.random() - 0.5) * 0.7, searchTimer: 0 };
      this.brains.push(brain);
      if (role === 'forager') {
        brain.route.push(...this.route(edge.to, 0));
      }
    }
  }

  /** Advance with fixed ticks so render frame rates do not alter the model. */
  step(dt: number): void {
    if (!Number.isFinite(dt) || dt <= 0) return;
    this.accumulator += dt;
    while (this.accumulator + 1e-9 >= TICK) {
      this.tick(TICK);
      this.accumulator -= TICK;
    }
  }

  snapshot(): ColonySnapshot {
    return {
      nodes: this.nodes.map(n => ({ ...n, position: copy(n.position) })),
      tunnels: this.tunnels.map(t => ({ ...t })),
      ants: this.ants.map(a => ({ ...a, position: copy(a.position), heading: copy(a.heading) })),
      food: copy(this.food), surfaceTrails: this.trails(), seed: this.seed,
      stats: { elapsed: this.elapsed, excavated: this.tunnels.filter(t => t.progress >= 1).length, foodCollected: this.foodCollected, contacts: this.contacts, activeDiggers: this.ants.filter(a => a.state === 'digging').length },
      events: [...this.events],
    };
  }

  moveFood(): void {
    this.food = { x: this.food.x > 0 ? -8 : 8, y: 0.25, z: 0 };
    this.record(`Food moved to the ${this.food.x > 0 ? 'east' : 'west'}. Old trails fade while scouts search.`);
  }

  private random(): number {
    this.randomState += 0x6d2b79f5;
    let t = this.randomState;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  private node(id: number): NestNode { return this.nodes[id]!; }
  private waypoint(nodeId: number, tunnelId: number | null): Waypoint { return { position: copy(this.node(nodeId).position), nodeId, tunnelId }; }
  private record(event: string): void { this.events = [event, ...this.events].slice(0, 5); }

  private tick(dt: number): void {
    this.elapsed += dt;
    const evaporation = Math.exp(-0.045 * dt);
    for (let i = 0; i < this.surfaceField.length; i++) this.surfaceField[i]! *= evaporation;
    for (const tunnel of this.tunnels) {
      tunnel.pheromone *= Math.exp(-0.1 * dt);
      tunnel.traffic *= Math.exp(-0.45 * dt);
    }
    for (let i = 0; i < this.ants.length; i++) this.updateAnt(this.ants[i]!, this.brains[i]!, dt);
    this.contactClock += dt;
    if (this.contactClock >= 0.5) {
      this.contactClock = 0;
      for (let i = 0; i < this.ants.length; i++) for (let j = i + 1; j < this.ants.length; j++) {
        const key = `${i}:${j}`;
        if (distance(this.ants[i]!.position, this.ants[j]!.position) < 0.2 && (this.contactCooldowns.get(key) ?? -10) < this.elapsed - 4) {
          this.contacts++;
          this.contactCooldowns.set(key, this.elapsed);
        }
      }
    }
  }

  private updateAnt(ant: Ant, brain: Brain, dt: number): void {
    if (brain.task === 'digging') { this.dig(ant, brain, dt); return; }
    if (brain.task === 'surface search' || brain.task === 'surface return') { this.surfaceStep(ant, brain, dt); return; }
    if (brain.rest > 0) { brain.rest -= dt; return; }
    if (brain.route.length) {
      const next = brain.route[0]!;
      const length = distance(ant.position, next.position);
      ant.tunnelId = next.tunnelId;
      if (length > 0.00001) {
        ant.heading = { x: (next.position.x - ant.position.x) / length, y: (next.position.y - ant.position.y) / length, z: (next.position.z - ant.position.z) / length };
        ant.position = interpolate(ant.position, next.position, Math.min(1, brain.speed * dt / length));
      }
      if (ant.tunnelId !== null) {
        const tunnel = this.tunnels[ant.tunnelId]!;
        tunnel.traffic = Math.min(1, tunnel.traffic + dt * 0.32);
        if (ant.state === 'carrying food') tunnel.pheromone = Math.min(1, tunnel.pheromone + dt * 0.3);
      }
      if (length <= brain.speed * dt) {
        ant.position = copy(next.position);
        if (next.nodeId !== null) { brain.previousNode = brain.nodeId; brain.nodeId = next.nodeId; }
        brain.route.shift();
      }
      return;
    }
    ant.tunnelId = null;
    if (brain.task === 'approaching dig') { brain.task = 'digging'; brain.workLeft = 1.4 + this.random() * 2; ant.state = 'digging'; return; }
    if (brain.task === 'returning soil') { ant.carrying = false; ant.state = 'exploring'; brain.task = 'wandering'; }
    if (brain.task === 'outbound') {
      brain.task = 'surface search'; ant.state = 'seeking food';
      ant.position.y = 0.25; brain.searchTimer = 0;
      return;
    }
    if (brain.task === 'returning food') {
      ant.carrying = false; this.foodCollected++; ant.state = 'seeking food'; brain.task = 'outbound';
      if (this.foodCollected === 1) this.record('A forager returns. Its chemical trail begins to accumulate.');
      brain.route = this.route(brain.nodeId, 0);
      brain.surfaceAngle = (this.random() < 0.5 ? 0 : Math.PI) + (this.random() - 0.5) * 0.7;
      brain.rest = 0.2 + this.random() * 1.2;
      return;
    }
    if (ant.role === 'excavator') {
      const fronts = this.tunnels.filter(t => t.from === brain.nodeId && t.progress < 1);
      if (fronts.length) {
        const front = fronts[Math.floor(this.random() * fronts.length)]!;
        brain.digId = front.id; brain.task = 'approaching dig'; ant.state = 'exploring';
        brain.route = [{ position: interpolate(this.node(front.from).position, this.node(front.to).position, front.progress), nodeId: null, tunnelId: front.id }];
        return;
      }
    }
    const connected = this.tunnels.filter(t => t.progress === 1 && (t.from === brain.nodeId || t.to === brain.nodeId));
    const fresh = connected.filter(t => (t.from === brain.nodeId ? t.to : t.from) !== brain.previousNode);
    const choices = fresh.length && this.random() > 0.12 ? fresh : connected;
    if (!choices.length) return;
    const next = choices[Math.floor(this.random() * choices.length)]!;
    brain.route = [this.waypoint(next.from === brain.nodeId ? next.to : next.from, next.id)];
    if (ant.role === 'nurse') { ant.state = 'tending brood'; brain.rest = 1 + this.random() * 3; }
  }

  /** Three forward sensors sample only the nearby trail; food is detected by proximity. */
  private surfaceStep(ant: Ant, brain: Brain, dt: number): void {
    ant.tunnelId = null;
    ant.position.y = 0.25;
    if (brain.task === 'surface return') {
      this.deposit(ant.position, dt);
      const length = Math.hypot(ant.position.x, ant.position.z);
      if (length < 0.18) {
        ant.position = { x: 0, y: 0, z: 0 };
        brain.nodeId = 0; brain.task = 'returning food'; brain.route = this.route(0, 1);
        return;
      }
      ant.heading = { x: -ant.position.x / length, y: 0, z: -ant.position.z / length };
      ant.position.x += ant.heading.x * brain.speed * dt;
      ant.position.z += ant.heading.z * brain.speed * dt;
      return;
    }
    if (Math.hypot(ant.position.x - this.food.x, ant.position.z - this.food.z) < 0.7) {
      brain.task = 'surface return'; ant.carrying = true; ant.state = 'carrying food';
      return;
    }
    brain.searchTimer += dt;
    const sense = (angle: number): number => this.sample(ant.position.x + Math.cos(angle) * 0.7, ant.position.z + Math.sin(angle) * 0.7);
    const front = sense(brain.surfaceAngle);
    const left = sense(brain.surfaceAngle - 0.65);
    const right = sense(brain.surfaceAngle + 0.65);
    // A small persistent exploration component prevents an abandoned trail trapping the colony.
    if (Math.max(front, left, right) > 0.005 && this.random() > 0.15) {
      if (left > front && left > right) brain.surfaceAngle -= 2.1 * dt;
      else if (right > front && right > left) brain.surfaceAngle += 2.1 * dt;
    }
    brain.surfaceAngle += (this.random() - 0.5) * 1.4 * Math.sqrt(dt);
    if (brain.searchTimer > 4 + (ant.id % 4)) {
      brain.surfaceAngle += (this.random() - 0.5) * 1.4;
      brain.searchTimer = 0;
    }
    let dx = Math.cos(brain.surfaceAngle);
    let dz = Math.sin(brain.surfaceAngle);
    if (Math.abs(ant.position.x + dx * 0.4) > 9.8) { dx *= -1; brain.surfaceAngle = Math.atan2(dz, dx); }
    if (Math.abs(ant.position.z + dz * 0.4) > 1.85) { dz *= -1; brain.surfaceAngle = Math.atan2(dz, dx); }
    ant.heading = { x: dx, y: 0, z: dz };
    ant.position.x = Math.max(-9.8, Math.min(9.8, ant.position.x + dx * brain.speed * dt));
    ant.position.z = Math.max(-1.85, Math.min(1.85, ant.position.z + dz * brain.speed * dt));
  }

  private fieldIndex(x: number, z: number): number {
    const column = Math.round((x - FIELD_X_MIN) / FIELD_SPACING);
    const row = Math.round((z - FIELD_Z_MIN) / FIELD_SPACING);
    return column < 0 || column >= FIELD_COLUMNS || row < 0 || row >= FIELD_ROWS ? -1 : row * FIELD_COLUMNS + column;
  }

  private sample(x: number, z: number): number {
    const index = this.fieldIndex(x, z);
    return index < 0 ? 0 : this.surfaceField[index]!;
  }

  private deposit(position: Vec3, dt: number): void {
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const index = this.fieldIndex(position.x + dx * FIELD_SPACING, position.z + dz * FIELD_SPACING);
      if (index >= 0) this.surfaceField[index] = Math.min(1, this.surfaceField[index]! + dt * (dx === 0 && dz === 0 ? 1.1 : 0.22));
    }
  }

  private trails(): SurfaceTrail[] {
    const trails: SurfaceTrail[] = [];
    for (let i = 0; i < this.surfaceField.length; i++) {
      const intensity = this.surfaceField[i]!;
      if (intensity < 0.003) continue;
      trails.push({ position: { x: FIELD_X_MIN + (i % FIELD_COLUMNS) * FIELD_SPACING, y: 0.27, z: FIELD_Z_MIN + Math.floor(i / FIELD_COLUMNS) * FIELD_SPACING }, intensity });
    }
    return trails;
  }

  private dig(ant: Ant, brain: Brain, dt: number): void {
    const tunnel = this.tunnels[brain.digId!]!;
    const from = this.node(tunnel.from).position;
    const to = this.node(tunnel.to).position;
    if (tunnel.progress < 1) {
      tunnel.progress = Math.min(1, tunnel.progress + dt * 0.022 / distance(from, to));
      tunnel.traffic = Math.min(1, tunnel.traffic + dt * 0.2);
      if (tunnel.progress === 1) { this.record('A passage opens. Workers explore the new edge.'); this.extend(tunnel.to); }
    }
    ant.position = interpolate(from, to, tunnel.progress);
    const length = distance(from, to);
    ant.heading = { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length };
    ant.tunnelId = tunnel.id;
    brain.workLeft -= dt;
    if (brain.workLeft <= 0 || tunnel.progress === 1) {
      ant.carrying = true; ant.state = 'carrying soil'; brain.task = 'returning soil';
      brain.nodeId = tunnel.progress === 1 ? tunnel.to : tunnel.from;
      brain.route = tunnel.progress === 1 ? this.route(tunnel.to, 0) : [this.waypoint(tunnel.from, tunnel.id), ...this.route(tunnel.from, 0)];
    }
  }

  /** Grow only from the newly encountered excavation front, subject to available neighboring space. */
  private extend(nodeId: number): void {
    if (this.tunnels.length >= MAX_TUNNELS) return;
    const origin = this.node(nodeId);
    origin.kind = this.random() < 0.55 ? 'chamber' : 'junction';
    origin.radius = origin.kind === 'chamber' ? 0.5 + this.random() * 0.22 : 0.38;
    const count = this.random() < 0.4 ? 2 : 1;
    for (let branch = 0; branch < count && this.tunnels.length < MAX_TUNNELS; branch++) {
      for (let attempt = 0; attempt < 18; attempt++) {
        const angle = (this.random() - 0.5) * Math.PI * 1.4;
        const length = 1.6 + this.random() * 1.1;
        const position = { x: origin.position.x + Math.sin(angle) * length, y: origin.position.y - Math.cos(angle) * length, z: Math.max(-1.8, Math.min(1.8, origin.position.z + (this.random() - 0.5) * 1.8)) };
        if (Math.abs(position.x) > 9.5 || position.y < -11.5 || position.y > -1.4 || this.nodes.some(n => distance(n.position, position) < 1.3)) continue;
        const id = this.nodes.length;
        this.nodes.push({ id, position, radius: 0.4, kind: 'junction' });
        this.tunnels.push({ id: this.tunnels.length, from: nodeId, to: id, progress: 0, pheromone: 0, traffic: 0 });
        break;
      }
    }
  }

  /** Shortest paths are a navigation abstraction, not a claim that ants have a global nest map. */
  private route(start: number, end: number): Waypoint[] {
    if (start === end) return [];
    const queue = [start];
    const visited = new Map<number, { node: number; tunnel: number }>();
    visited.set(start, { node: start, tunnel: -1 });
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const current = queue[cursor]!;
      for (const tunnel of this.tunnels) {
        if (tunnel.progress < 1 || (tunnel.from !== current && tunnel.to !== current)) continue;
        const next = tunnel.from === current ? tunnel.to : tunnel.from;
        if (visited.has(next)) continue;
        visited.set(next, { node: current, tunnel: tunnel.id });
        if (next === end) {
          const result: Waypoint[] = [];
          let at = end;
          while (at !== start) { const via = visited.get(at)!; result.unshift(this.waypoint(at, via.tunnel)); at = via.node; }
          return result;
        }
        queue.push(next);
      }
    }
    return [];
  }
}
