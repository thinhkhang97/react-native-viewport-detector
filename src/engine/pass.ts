import type { Rect } from '../types';
import { hasArea, queryRange, rebuildIndex, type RootIndex, type RootRecord, type TargetRecord } from './rootIndex';
import type { RootHandle } from './types';

/**
 * 'scroll' = content moved: measure every target near the viewport (and the ones in view);
 * 'settle' = scrolling stopped: same as 'scroll', used as the corrective pass after a scroll ends;
 * 'full'   = layout may have changed anywhere: measure every target.
 */
export type PassKind = 'scroll' | 'settle' | 'full';

const RANK: Record<PassKind, number> = { scroll: 1, settle: 2, full: 3 };
const MAX_STEP_PAD = 200;

export function strongest(a: PassKind | null | undefined, b: PassKind): PassKind {
  return a && RANK[a] >= RANK[b] ? a : b;
}

export interface PlannedRoot {
  record: RootRecord;
  kind: PassKind;
  /** Targets to measure natively in this pass. */
  measured: TargetRecord[];
}

export interface PassPlan {
  roots: PlannedRoot[];
  windowTargets: TargetRecord[];
}

/** Strongest dirty kind on the path from this root up to the top ('full' wins), or null if untouched. */
export function kindFor(record: RootRecord, dirtyRoots: Map<number, PassKind>): PassKind | null {
  let kind: PassKind | null = null;
  for (let h: RootHandle | null = record.handle; h; h = h.parent) {
    const own = dirtyRoots.get(h.id);
    if (own) kind = strongest(kind, own);
  }
  return kind;
}

export function shift(rect: Rect, dx: number, dy: number): Rect {
  return { ...rect, x: rect.x + dx, y: rect.y + dy };
}

/** The target whose cached rect is closest to the root's current bounds (used when none is near). */
function closestTo(index: RootIndex, bounds: Rect | null): TargetRecord | null {
  const placed = index.sorted.filter(t => hasArea(t.base));
  if (placed.length === 0) return null;
  if (!bounds) return placed[0];
  const centre = (r: Rect) => (index.axis === 'y' ? r.y + r.height / 2 : r.x + r.width / 2);
  return placed.reduce((best, t) =>
    Math.abs(centre(t.base!) - centre(bounds)) < Math.abs(centre(best.base!) - centre(bounds)) ? t : best
  );
}

/**
 * Decides what a root measures. Scroll passes measure everything near the viewport — never a single
 * anchor whose own movement could be mistaken for the whole list's — plus targets that need it.
 */
export function planRoot(record: RootRecord, requested: PassKind): PlannedRoot {
  const { index } = record;
  if (index.stale) rebuildIndex(index);
  const hasBases = index.sorted.some(t => hasArea(t.base));
  if (requested === 'full' || !hasBases) {
    return { record, kind: 'full', measured: [...index.targets] };
  }
  const { dx, dy } = record.offset;
  const bounds = record.effective ? shift(record.effective, -dx, -dy) : null;
  // Widen by the last scroll step so fast scrolling can't skip rows; capped so one big jump doesn't measure the world.
  const near = bounds ? queryRange(index, bounds, Math.min(record.lastStep, MAX_STEP_PAD)) : [];
  const measured = new Set<TargetRecord>([...index.inView, ...near, ...index.dirty]);
  if (![...measured].some(t => hasArea(t.base))) {
    const probe = closestTo(index, bounds);
    if (probe) measured.add(probe);
  }
  return { record, kind: requested, measured: [...measured] };
}
