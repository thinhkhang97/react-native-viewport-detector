import {
  computeEntry,
  intersect,
  normalizeMargin,
  nestedRootRect,
  outermostRootRect,
} from '../geometry';

const NO_MARGIN = normalizeMargin(0);
const WINDOW = { x: 0, y: 0, width: 390, height: 844 };

describe('normalizeMargin', () => {
  it('applies a number to every side', () => {
    expect(normalizeMargin(10)).toEqual({ top: 10, right: 10, bottom: 10, left: 10 });
  });

  it('fills missing sides with 0', () => {
    expect(normalizeMargin({ bottom: 200 })).toEqual({ top: 0, right: 0, bottom: 200, left: 0 });
  });

  it('defaults to zero margins', () => {
    expect(normalizeMargin(undefined)).toEqual(NO_MARGIN);
  });
});

describe('intersect', () => {
  it('returns the overlapping area', () => {
    expect(
      intersect({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 80, width: 100, height: 100 })
    ).toEqual({ x: 50, y: 80, width: 50, height: 20 });
  });

  it('returns an empty rectangle for disjoint inputs', () => {
    const r = intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 0, y: 50, width: 10, height: 10 });
    expect(r.width).toBe(0);
    expect(r.height).toBe(0);
  });
});

describe('effective roots', () => {
  it('applies the outermost margin after window clipping', () => {
    expect(
      outermostRootRect({ x: 0, y: 100, width: 390, height: 700 }, WINDOW, normalizeMargin({ bottom: 200 }))
    ).toEqual({ x: 0, y: 100, width: 390, height: 900 });
  });

  it('carries an outer preload margin into a nested root', () => {
    const outer = outermostRootRect({ x: 0, y: 100, width: 390, height: 700 }, WINDOW, normalizeMargin({ bottom: 200 }));
    const carousel = nestedRootRect({ x: 0, y: 950, width: 390, height: 120 }, NO_MARGIN, outer);
    expect(carousel).toEqual({ x: 0, y: 950, width: 390, height: 50 });

    const item = computeEntry({ x: 0, y: 950, width: 120, height: 50 }, carousel, NO_MARGIN, 0);
    expect(item.isIntersecting).toBe(true);
  });
});

describe('computeEntry', () => {
  const root = { x: 0, y: 0, width: 100, height: 100 };

  it('reports the visible share of the target area', () => {
    const entry = computeEntry({ x: 0, y: 50, width: 100, height: 100 }, root, NO_MARGIN, 7);
    expect(entry.intersectionRatio).toBe(0.5);
    expect(entry.isIntersecting).toBe(true);
    expect(entry.time).toBe(7);
  });

  it('intersectionRatio is 0 for a zero-area target', () => {
    const entry = computeEntry({ x: 10, y: 10, width: 0, height: 0 }, root, NO_MARGIN, 0);
    expect(entry.intersectionRatio).toBe(0);
    expect(Number.isNaN(entry.intersectionRatio)).toBe(false);
    expect(entry.isIntersecting).toBe(false);
  });

  it('adds a target-level margin on top of the root', () => {
    const entry = computeEntry({ x: 0, y: 110, width: 100, height: 10 }, root, normalizeMargin({ bottom: 20 }), 0);
    expect(entry.isIntersecting).toBe(true);
  });
});
