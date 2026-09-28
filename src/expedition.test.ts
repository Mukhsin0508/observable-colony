import { describe, expect, it } from 'vitest';
import { CHAPTERS, Expedition } from './expedition';

describe('guided journey', () => {
  it('honors pause and advances only once at a chapter boundary', () => {
    const tour = new Expedition(); tour.start();
    expect(tour.step(30, true)).toBe(false);
    expect(tour.progress).toBe(0);
    expect(tour.step(10, false)).toBe(false);
    expect(tour.step(1, false)).toBe(true);
    expect(tour.index).toBe(1);
    expect(tour.progress).toBe(0);
  });
  it('ends on recorded evidence without looping or fabricating another chapter', () => {
    const tour = new Expedition(); tour.start(); tour.seek(CHAPTERS.length - 1);
    expect(tour.chapter.mode).toBe('measured');
    expect(tour.step(20, false)).toBe(false);
    expect(tour.auto).toBe(false);
    expect(tour.progress).toBe(1);
    expect(tour.active).toBe(true);
  });
  it('allows manual browsing with autoplay off and resets cleanly', () => {
    const tour = new Expedition(); tour.start(false); tour.seek(4);
    tour.step(20, false); expect(tour.index).toBe(4);
    tour.stop(); tour.step(30, false); expect(tour.index).toBe(4);
    tour.start(false); expect(tour.index).toBe(0); expect(tour.elapsed).toBe(0);
    tour.seek(NaN); expect(tour.index).toBe(0);
  });
});
