import { bucketOf, isInView, normalizeThresholds, thresholdsKey } from '../thresholds';

describe('normalizeThresholds', () => {
  it('defaults to [0]', () => {
    expect(normalizeThresholds(undefined)).toEqual([0]);
  });

  it('wraps a single number', () => {
    expect(normalizeThresholds(0.5)).toEqual([0.5]);
  });

  it('clamps, sorts and dedupes', () => {
    expect(normalizeThresholds([1, 0.5, 0.5, -1])).toEqual([0, 0.5, 1]);
  });

  it('builds a content key', () => {
    expect(thresholdsKey([0, 0.5])).toBe('0,0.5');
  });
});

describe('bucketOf', () => {
  const thresholds = [0, 0.5, 1];

  it('returns the largest threshold reached', () => {
    expect(bucketOf({ isIntersecting: true, intersectionRatio: 0.6 }, thresholds)).toBe(1);
    expect(bucketOf({ isIntersecting: true, intersectionRatio: 1 }, thresholds)).toBe(2);
  });

  it('is -1 when not intersecting', () => {
    expect(bucketOf({ isIntersecting: false, intersectionRatio: 0 }, thresholds)).toBe(-1);
  });

  it('is -1 when below the lowest threshold', () => {
    expect(bucketOf({ isIntersecting: true, intersectionRatio: 0.3 }, [0.5])).toBe(-1);
  });

  it('maps buckets to inView', () => {
    expect(isInView(-1)).toBe(false);
    expect(isInView(0)).toBe(true);
  });
});
