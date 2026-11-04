import type { ViewportEntry } from './types';

type Crossing = Pick<ViewportEntry, 'isIntersecting' | 'intersectionRatio'>;

export function normalizeThresholds(threshold?: number | number[]): number[] {
  const list = threshold === undefined ? [0] : Array.isArray(threshold) ? threshold : [threshold];
  const clamped = list.map(t => Math.min(1, Math.max(0, t)));
  return Array.from(new Set(clamped)).sort((a, b) => a - b);
}

export function thresholdsKey(thresholds: number[]): string {
  return thresholds.join(',');
}

/** Index of the largest threshold reached, or -1 when not intersecting / below every threshold. */
export function bucketOf(entry: Crossing, thresholds: number[]): number {
  if (!entry.isIntersecting) {
    return -1;
  }
  let bucket = -1;
  thresholds.forEach((t, i) => {
    if (entry.intersectionRatio >= t) {
      bucket = i;
    }
  });
  return bucket;
}

export function isInView(bucket: number): boolean {
  return bucket >= 0;
}
