import { describe, expect, it } from 'vitest';
import { ColonyLifecycle, LIFECYCLE_STAGES } from './lifecycle';

describe('illustrative colony lifecycle', () => {
  it('begins with one queen and no workers, then follows complete metamorphosis', () => {
    const life = new ColonyLifecycle();
    expect(life.snapshot()).toMatchObject({ phase: 'founding', queenAlive: true, eggs: 0, larvae: 0, pupae: 0, workers: 0, alates: 0 });
    life.step(3);
    expect(life.snapshot()).toMatchObject({ phase: 'eggs', eggs: 12, workers: 0 });
    life.step(14);
    expect(life.snapshot().phase).toBe('larvae');
    expect(life.snapshot().larvae).toBeGreaterThan(0);
    life.step(20);
    expect(life.snapshot().phase).toBe('pupae');
    expect(life.snapshot().pupae).toBeGreaterThan(0);
    life.step(23);
    expect(life.snapshot().phase).toBe('first-workers');
    expect(life.snapshot().workers).toBeGreaterThan(0);
  });

  it('is reproducible across fractional steps, reset and stage seek', () => {
    const a = new ColonyLifecycle(42);
    const b = new ColonyLifecycle(42);
    a.step(365);
    for (let i = 0; i < 1460; i++) b.step(0.25);
    expect(a.snapshot()).toEqual(b.snapshot());
    b.reset(); b.seek('growth');
    expect(a.snapshot()).toEqual(b.snapshot());
  });

  it('exposes every waypoint with finite nonnegative integer populations', () => {
    const life = new ColonyLifecycle(1709);
    for (const stage of LIFECYCLE_STAGES) {
      life.seek(stage.id);
      const snapshot = life.snapshot();
      expect(snapshot.day).toBe(stage.day);
      expect(snapshot.calibration).toBe('illustrative');
      for (const count of [snapshot.eggs, snapshot.larvae, snapshot.pupae, snapshot.workers, snapshot.alates, snapshot.totalBorn, snapshot.totalDied]) {
        expect(Number.isInteger(count)).toBe(true);
        expect(count).toBeGreaterThanOrEqual(0);
      }
      if (stage.id === 'growth') expect(snapshot.workers).toBeGreaterThan(12);
      if (stage.id === 'reproduction') expect(snapshot.alates).toBeGreaterThan(0);
    }
  });

  it('stops laying after queen loss while existing brood matures and workers later decline', () => {
    const life = new ColonyLifecycle(15);
    life.seek('growth');
    const before = life.snapshot();
    life.setQueenAlive(false);
    life.step(60);
    const afterBrood = life.snapshot();
    expect(afterBrood).toMatchObject({ phase: 'decline', queenAlive: false, eggs: 0, larvae: 0, pupae: 0 });
    expect(afterBrood.totalBorn).toBeGreaterThan(before.totalBorn);
    life.step(700);
    expect(life.snapshot().workers).toBe(0);
    expect(life.snapshot().totalDied).toBeGreaterThan(afterBrood.totalDied);
  });

  it('can resume brood development when a restored queen missed the initial clutch', () => {
    const life = new ColonyLifecycle(1709);
    life.setQueenAlive(false);
    life.step(10);
    life.setQueenAlive(true);
    expect(life.snapshot()).toMatchObject({ queenAlive: true, eggs: 12, workers: 0 });
    life.setQueenAlive(true);
    expect(life.snapshot().eggs).toBe(12);
    life.step(57);
    expect(life.snapshot().workers).toBeGreaterThan(0);
  });

  it('restores before the first egg day without creating an early or duplicate clutch', () => {
    const life = new ColonyLifecycle();
    life.setQueenAlive(false);
    life.step(1);
    life.setQueenAlive(true);
    expect(life.snapshot().eggs).toBe(0);
    life.step(2);
    expect(life.snapshot().eggs).toBe(12);
    life.step(1);
    expect(life.snapshot().eggs).toBe(12);
  });

  it('can restart a founding clutch after all workers and brood have disappeared', () => {
    const life = new ColonyLifecycle();
    life.seek('growth');
    life.setQueenAlive(false);
    life.step(800);
    expect(life.snapshot()).toMatchObject({ workers: 0, eggs: 0, larvae: 0, pupae: 0 });
    life.setQueenAlive(true);
    expect(life.snapshot().eggs).toBe(12);
    life.step(57);
    expect(life.snapshot().workers).toBeGreaterThan(0);
  });

  it('never schedules natural queen death and rejects invalid inputs without mutation', () => {
    const life = new ColonyLifecycle(7);
    life.step(365 * 20);
    expect(life.snapshot().queenAlive).toBe(true);
    const before = life.snapshot();
    expect(() => life.seek('unknown')).toThrow(RangeError);
    expect(() => life.step(-1)).toThrow(RangeError);
    expect(() => life.step(Infinity)).toThrow(RangeError);
    expect(life.snapshot()).toEqual(before);
    const edited = life.snapshot(); edited.events.push('outside');
    expect(life.snapshot().events).not.toContain('outside');
  });
});
