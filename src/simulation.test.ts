import { describe, expect, it } from 'vitest';
import { ColonySimulation } from './simulation';

describe('colony model', () => {
  it('is deterministic across render frame sizes and reset', () => {
    const a = new ColonySimulation(42);
    const b = new ColonySimulation(42);
    a.step(60);
    for (let i = 0; i < 600; i++) b.step(0.1);
    expect(a.snapshot()).toEqual(b.snapshot());
    b.reset(); b.step(60);
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('grows connected passages through worker excavation and returns food', () => {
    const model = new ColonySimulation(1709);
    const initial = model.snapshot();
    model.step(600);
    const result = model.snapshot();
    expect(result.stats.excavated).toBeGreaterThan(initial.stats.excavated);
    expect(result.tunnels.length).toBeGreaterThan(initial.tunnels.length);
    expect(result.stats.foodCollected).toBeGreaterThan(0);
    expect(result.stats.contacts).toBeGreaterThan(0);
    for (const tunnel of result.tunnels) {
      expect(tunnel.progress).toBeGreaterThanOrEqual(0);
      expect(tunnel.progress).toBeLessThanOrEqual(1);
      expect(result.nodes[tunnel.from]).toBeDefined();
      expect(result.nodes[tunnel.to]).toBeDefined();
      expect(tunnel.to).toBeGreaterThan(tunnel.from);
    }
    for (const ant of result.ants) {
      expect(Object.values(ant.position).every(Number.isFinite)).toBe(true);
      expect(Math.abs(ant.position.x)).toBeLessThanOrEqual(10);
      expect(ant.position.y).toBeGreaterThanOrEqual(-12);
    }
    expect(result.tunnels.length).toBeLessThanOrEqual(40);
  });

  it('creates bounded chemical signal after returning food and reroutes to moved food', () => {
    const model = new ColonySimulation(22);
    expect(model.snapshot().tunnels.every(t => t.pheromone === 0)).toBe(true);
    model.step(60);
    const before = model.snapshot();
    expect(before.tunnels.some(t => t.pheromone > 0)).toBe(true);
    model.moveFood();
    expect(model.snapshot().food.x).toBe(-before.food.x);
    model.step(90);
    const after = model.snapshot();
    expect(after.ants.some(a => a.role === 'forager' && a.position.x < -3)).toBe(true);
    expect(after.stats.foodCollected).toBeGreaterThan(before.stats.foodCollected);
    expect(after.tunnels.every(t => t.pheromone >= 0 && t.pheromone <= 1)).toBe(true);
  });

  it('lays a surface field and lets an abandoned trail evaporate after food moves', () => {
    const model = new ColonySimulation(22);
    expect(model.snapshot().surfaceTrails).toEqual([]);
    model.step(60);
    const before = model.snapshot();
    const easternSignal = (trails: typeof before.surfaceTrails): number => trails.filter(t => t.position.x > 3).reduce((sum, t) => sum + t.intensity, 0);
    const originalSignal = easternSignal(before.surfaceTrails);
    expect(originalSignal).toBeGreaterThan(0);
    model.moveFood();
    expect(model.snapshot().ants).toEqual(before.ants); // Relocation sends no instant directions to workers.
    model.step(180);
    const after = model.snapshot();
    expect(easternSignal(after.surfaceTrails)).toBeLessThan(originalSignal * 0.1);
    expect(after.surfaceTrails.some(t => t.position.x < -3 && t.intensity > 0.01)).toBe(true);
    expect(after.surfaceTrails.every(t => t.intensity > 0 && t.intensity <= 1)).toBe(true);
  });

  it('spreads a new representative workforce without duplicate spawn positions', () => {
    const a = new ColonySimulation(42);
    const b = new ColonySimulation(42);
    for (const model of [a, b]) { model.setPopulation(0); model.setPopulation(110); }
    const snapshot = a.snapshot();
    expect(snapshot).toEqual(b.snapshot());
    expect(snapshot.ants).toHaveLength(110);
    const positions = snapshot.ants.map(ant => Object.values(ant.position).map(value => value.toFixed(6)).join(','));
    expect(new Set(positions).size).toBe(110);
    expect(new Set(snapshot.ants.map(ant => ant.role)).size).toBe(3);
    // Populations larger than the rendering budget keep the same representative agents.
    a.setPopulation(10_000);
    expect(a.snapshot()).toEqual(snapshot);
    a.step(120);
    for (let frame = 0; frame < 1200; frame++) b.step(0.1);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.snapshot().ants.every(ant => Object.values(ant.position).every(Number.isFinite))).toBe(true);
  });

  it('keeps small births in the chamber and ignores invalid population values', () => {
    const model = new ColonySimulation(5);
    model.setPopulation(0); model.setPopulation(11);
    const snapshot = model.snapshot();
    const chamber = snapshot.nodes[1]!;
    for (const ant of snapshot.ants) {
      expect(Math.hypot(ant.position.x - chamber.position.x, ant.position.y - chamber.position.y, ant.position.z - chamber.position.z)).toBeLessThan(chamber.radius);
    }
    model.setPopulation(NaN); model.setPopulation(Infinity); model.setPopulation(-Infinity);
    expect(model.snapshot()).toEqual(snapshot);
    model.setPopulation(-1);
    expect(model.snapshot().ants).toHaveLength(0);
    expect(model.inspectAnt(0)).toBeNull();
  });

  it('reports actual local sensor and deposition states without mutating the model', () => {
    const model = new ColonySimulation(22);
    expect(model.inspectAnt(-1)).toBeNull();
    expect(model.inspectAnt(1.5)).toBeNull();
    expect(model.inspectAnt(10_000)).toBeNull();
    let sawReturn = false;
    let sawChemicalReading = false;
    for (let frame = 0; frame < 180; frame++) {
      model.step(0.5);
      const snapshot = model.snapshot();
      for (const ant of snapshot.ants) {
        const reading = model.inspectAnt(ant.id)!;
        expect([reading.ahead, reading.left, reading.right].every(value => Number.isFinite(value) && value >= 0 && value <= 1)).toBe(true);
        const neighbors = snapshot.ants.filter(other => other.id !== ant.id && Math.hypot(other.position.x - ant.position.x, other.position.y - ant.position.y, other.position.z - ant.position.z) < 0.55).length;
        expect(reading.localNeighbors).toBe(neighbors);
        if (ant.position.y < 0) expect(reading).toMatchObject({ ahead: 0, left: 0, right: 0, depositing: false });
        if (reading.depositing) {
          sawReturn = true;
          expect(ant.state).toBe('carrying food');
          expect(ant.position.y).toBe(0.25);
          expect(ant.tunnelId).toBeNull();
        }
        if (Math.max(reading.ahead, reading.left, reading.right) > 0) sawChemicalReading = true;
      }
      expect(model.snapshot()).toEqual(snapshot);
    }
    expect(sawReturn).toBe(true);
    expect(sawChemicalReading).toBe(true);
  });

  it('returns independent snapshots and ignores invalid time deltas', () => {
    const model = new ColonySimulation();
    const before = model.snapshot();
    model.step(-1); model.step(NaN); model.step(Infinity);
    expect(model.snapshot()).toEqual(before);
    before.ants[0]!.position.x = 999;
    expect(model.snapshot().ants[0]!.position.x).not.toBe(999);
  });
});
