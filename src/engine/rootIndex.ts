import type { HostNode } from '../measure';
import type { Margin, Rect } from '../types';
import type { EntryCallback, NormalizedOptions, RootHandle } from './types';

export interface TargetRecord {
  id: number;
  getNode: () => HostNode | null;
  root: RootHandle | null;
  opts: NormalizedOptions;
  cb: EntryCallback;
  bucket: number | null; // null = never reported
  /** Window rect at its last measurement, minus the root offset at that time. */
  base: Rect | null;
  /** Needs its own measurement (new, laid out again, or refreshed). */
  dirty: boolean;
}

export interface RootRecord {
  handle: RootHandle;
  getNode: () => HostNode | null;
  margin: Margin;
  depth: number;
  effective: Rect | null;
  /** Translation of all targets since the last full pass (median of measured targets' movement). */
  offset: { dx: number; dy: number };
  /** Size of the last offset change, used to widen the "near the viewport" query while scrolling fast. */
  lastStep: number;
  index: RootIndex;
}

/** Targets of one root sorted along the axis they spread over, for range queries during scroll passes. */
export interface RootIndex {
  targets: Set<TargetRecord>;
  inView: Set<TargetRecord>;
  /** Targets waiting for their own measurement. */
  dirty: Set<TargetRecord>;
  sorted: TargetRecord[];
  stale: boolean;
  axis: 'x' | 'y';
  maxExtent: number;
  maxMargin: number;
}

export function createRootIndex(): RootIndex {
  return {
    targets: new Set(),
    inView: new Set(),
    dirty: new Set(),
    sorted: [],
    stale: true,
    axis: 'y',
    maxExtent: 0,
    maxMargin: 0,
  };
}

export function hasArea(rect: Rect | null): rect is Rect {
  return !!rect && rect.width > 0 && rect.height > 0;
}

function startOf(t: TargetRecord, axis: 'x' | 'y'): number {
  return t.base ? (axis === 'y' ? t.base.y : t.base.x) : Number.POSITIVE_INFINITY;
}

export function rebuildIndex(index: RootIndex): void {
  const placed = [...index.targets].filter(t => t.base);
  const spread = (axis: 'x' | 'y') => {
    const starts = placed.map(t => startOf(t, axis));
    return starts.length ? Math.max(...starts) - Math.min(...starts) : 0;
  };
  index.axis = spread('x') > spread('y') ? 'x' : 'y';
  index.sorted = placed.sort((a, b) => startOf(a, index.axis) - startOf(b, index.axis));
  index.maxExtent = placed.reduce((m, t) => Math.max(m, index.axis === 'y' ? t.base!.height : t.base!.width), 0);
  index.maxMargin = placed.reduce((m, t) => {
    const { top, right, bottom, left } = t.opts.targetMargin;
    return Math.max(m, top, right, bottom, left);
  }, 0);
  index.stale = false;
}

function firstAtOrAfter(sorted: TargetRecord[], axis: 'x' | 'y', value: number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (startOf(sorted[mid], axis) < value) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** Targets whose base rect may overlap `bounds` (given in base coordinates), along the index axis. */
export function queryRange(index: RootIndex, bounds: Rect, extraPad = 0): TargetRecord[] {
  const pad = index.maxMargin + 1 + 2 * extraPad;
  const lo = (index.axis === 'y' ? bounds.y : bounds.x) - pad;
  const hi = (index.axis === 'y' ? bounds.y + bounds.height : bounds.x + bounds.width) + pad;
  const result: TargetRecord[] = [];
  for (let i = firstAtOrAfter(index.sorted, index.axis, lo - index.maxExtent); i < index.sorted.length; i++) {
    const t = index.sorted[i];
    if (startOf(t, index.axis) > hi) break;
    result.push(t);
  }
  return result;
}
