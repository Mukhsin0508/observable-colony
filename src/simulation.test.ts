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

  it('returns independent snapshots and ignores invalid time deltas', () => {
    const model = new ColonySimulation();
    const before = model.snapshot();
    model.step(-1); model.step(NaN); model.step(Infinity);
    expect(model.snapshot()).toEqual(before);
    before.ants[0]!.position.x = 999;
    expect(model.snapshot().ants[0]!.position.x).not.toBe(999);
  });
});
