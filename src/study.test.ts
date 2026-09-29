import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStudy, describeStudy, excavationExtent, MILLIMETRES_PER_VOXEL } from './study';

const archive = JSON.parse(readFileSync(new URL('../public/data/excavation.json', import.meta.url), 'utf8'));

describe('archived excavation integrity', () => {
  it('reproduces every removal total from the supplied measured grain flags', () => {
    const data = parseStudy(archive);
    expect(new Set(data.points.map(p => p[0])).size).toBe(data.points.length);
    expect(data.frames).toHaveLength(52);
    for (const frame of data.frames) {
      const visibleRemoved = data.points.filter(p => p[4] >= 0 && p[4] <= frame.scan).length;
      expect(visibleRemoved).toBe(frame.removedCount);
    }
    expect(data.frames.at(-1)!.removedCount).toBe(5174);
  });

  it('keeps unknown timestamps unknown instead of assigning a simulated clock', () => {
    const data = parseStudy(archive);
    expect(data.frames.every(frame => frame.minutes === null)).toBe(true);
    expect(describeStudy(data, 4).timeLabel).toContain('elapsed time not assigned');
  });

  it('rejects corrupted coordinates and reversed removal chronology', () => {
    expect(() => parseStudy({ ...archive, points: [[1, Infinity, 0, 0, 2]] })).toThrow();
    expect(() => parseStudy({ ...archive, frames: [{ scan: 2, minutes: null, removedCount: 8 }, { scan: 1, minutes: null, removedCount: 0 }] })).toThrow();
  });

  it('measures the excavated span in millimetres from removed-grain centroids only', () => {
    const data = parseStudy(archive);
    expect(MILLIMETRES_PER_VOXEL).toBe(0.14);
    // The whole soil sample spans ~92 mm, matching the paper's 500 mL fill of a 7–9.8 cm frustum.
    const zs = data.points.map(p => p[3]);
    expect((Math.max(...zs) - Math.min(...zs)) * MILLIMETRES_PER_VOXEL).toBeCloseTo(91.85, 1);
    expect(excavationExtent(data, 1)).toBeNull();
    const early = excavationExtent(data, 2)!;
    expect(early.removed).toBe(8);
    expect(early.heightMm).toBeCloseTo(4.9, 1);
    const final = excavationExtent(data, 52)!;
    expect(final.removed).toBe(5174);
    expect(final.heightMm).toBeCloseTo(91.9, 1);
    expect(final.widthMm).toBeGreaterThan(90);
    // Height grows monotonically as removals accumulate.
    let previous = 0;
    for (const frame of data.frames.slice(1)) {
      const height = excavationExtent(data, frame.scan)!.heightMm;
      expect(height).toBeGreaterThanOrEqual(previous);
      previous = height;
    }
    expect(describeStudy(data, 18).extent!.heightMm).toBeCloseTo(excavationExtent(data, 19)!.heightMm, 6);
  });

  it('ignores retained context grains when measuring', () => {
    const extent = excavationExtent({ points: [[1, 0, 0, 0, -1], [2, 10, 20, 30, 3], [3, 110, 20, 80, 5], [4, 999, 999, 999, 9]] }, 5)!;
    expect(extent.removed).toBe(2);
    expect(extent.widthMm).toBeCloseTo(100 * 0.14, 9);
    expect(extent.depthMm).toBe(0);
    expect(extent.heightMm).toBeCloseTo(50 * 0.14, 9);
  });
});
