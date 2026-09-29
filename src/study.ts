import type { StudyViewState } from './journey-ui';

export type MeasuredPoint = [id: number, x: number, y: number, z: number, removedAtScan: number];
export interface MeasuredFrame { scan: number; minutes: number | null; removedCount: number; }
/**
 * SI Appendix p.2 (Buarque de Macedo et al. 2021): the time-series scans used 140 µm voxels.
 * Check: Experiment 1 centroids span ~656 voxels, i.e. ~92 mm, matching the 500 mL soil fill
 * of the 7–9.8 cm frustum. At 70 µm the soil would be an impossible ~46 mm.
 */
export const MILLIMETRES_PER_VOXEL = 0.14;

/** Axis-aligned span of removed-grain centroids up to a scan, in source axes (Z is height). */
export interface ExcavationExtent {
  removed: number;
  min: [x: number, y: number, z: number];
  max: [x: number, y: number, z: number];
  widthMm: number;
  depthMm: number;
  heightMm: number;
}

export interface MeasuredStudy {
  title: string; species: string; license: string; sourceUrl: string; coordinateUnit: string; note: string;
  points: MeasuredPoint[]; frames: MeasuredFrame[];
}

/** Reject malformed observations instead of substituting generated measurements. */
export function parseStudy(input: unknown): MeasuredStudy {
  if (typeof input !== 'object' || input === null) throw new Error('The archive metadata is missing.');
  const data = input as Record<string, unknown>;
  for (const key of ['title', 'species', 'license', 'sourceUrl', 'coordinateUnit', 'note']) {
    if (typeof data[key] !== 'string') throw new Error(`The archive is missing ${key}.`);
  }
  if (!Array.isArray(data.points) || data.points.length === 0 || data.points.some(p => !Array.isArray(p) || p.length !== 5 || p.some(v => !Number.isFinite(v)))) throw new Error('The archived grain coordinates are invalid.');
  if (!Array.isArray(data.frames) || data.frames.length === 0) throw new Error('The archived scans are missing.');
  let previousScan = -Infinity, previousRemoved = -1;
  for (const item of data.frames) {
    if (typeof item !== 'object' || item === null) throw new Error('An archived scan is invalid.');
    const frame = item as MeasuredFrame;
    if (!Number.isInteger(frame.scan) || frame.scan <= previousScan || !Number.isInteger(frame.removedCount) || frame.removedCount < previousRemoved || (frame.minutes !== null && (!Number.isFinite(frame.minutes) || frame.minutes < 0))) throw new Error('The archived scan chronology is invalid.');
    previousScan = frame.scan; previousRemoved = frame.removedCount;
  }
  return data as unknown as MeasuredStudy;
}

/** Measured from centroids only; the open void extends roughly one grain radius (~1 mm) further. */
export function excavationExtent(data: Pick<MeasuredStudy, 'points'>, scan: number): ExcavationExtent | null {
  const min: [number, number, number] = [Infinity, Infinity, Infinity];
  const max: [number, number, number] = [-Infinity, -Infinity, -Infinity];
  let removed = 0;
  for (const [, x, y, z, removedAt] of data.points) {
    if (removedAt < 0 || removedAt > scan) continue;
    removed++;
    if (x < min[0]) min[0] = x; if (x > max[0]) max[0] = x;
    if (y < min[1]) min[1] = y; if (y > max[1]) max[1] = y;
    if (z < min[2]) min[2] = z; if (z > max[2]) max[2] = z;
  }
  if (!removed) return null;
  return {
    removed, min, max,
    widthMm: (max[0] - min[0]) * MILLIMETRES_PER_VOXEL,
    depthMm: (max[1] - min[1]) * MILLIMETRES_PER_VOXEL,
    heightMm: (max[2] - min[2]) * MILLIMETRES_PER_VOXEL,
  };
}

export async function loadStudy(): Promise<MeasuredStudy> {
  const response = await fetch('/data/excavation.json');
  if (!response.ok) throw new Error(`The archive could not load (${response.status}). Reload to try again.`);
  return parseStudy(await response.json());
}

export function describeStudy(data: MeasuredStudy | null, index: number, error = ''): StudyViewState {
  if (!data) return { loaded: false, index: 0, frameCount: 0, label: error ? 'Archive unavailable' : 'Loading observations', timeLabel: 'No scan loaded', metricLabel: 'Removed grains', metricValue: '—', note: error || 'Loading the openly archived experiment. No synthetic data is substituted.', sourceUrl: '' };
  const frame = data.frames[Math.max(0, Math.min(index, data.frames.length - 1))];
  const extent = excavationExtent(data, frame.scan);
  return { loaded: true, index, frameCount: data.frames.length, label: data.title, timeLabel: frame.minutes === null ? `Scan ${frame.scan} · elapsed time not assigned` : `${frame.minutes} min from reference scan`, metricLabel: 'Measured grain removals', metricValue: frame.removedCount.toLocaleString(), note: data.note, sourceUrl: data.sourceUrl, volumeHistory: data.frames.map(f => f.removedCount), extent: extent ? { widthMm: extent.widthMm, depthMm: extent.depthMm, heightMm: extent.heightMm } : undefined };
}
