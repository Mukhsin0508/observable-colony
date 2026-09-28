import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseStudy, describeStudy } from './study';

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
});
