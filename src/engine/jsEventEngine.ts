import { unstable_batchedUpdates } from 'react-native';
import { computeEntry, nestedRootRect, outermostRootRect } from '../geometry';
import { measureRect, type HostNode } from '../measure';
import { createFrameScheduler } from '../scheduler';
import { bucketOf } from '../thresholds';
import type { Rect, ViewportEntry } from '../types';
import { kindFor, planRoot, shift, strongest, type PassKind, type PassPlan, type PlannedRoot } from './pass';
import {
  createRootIndex,
  hasArea,
  queryRange,
  rebuildIndex,
  type RootIndex,
  type RootRecord,
  type TargetRecord,
} from './rootIndex';
import { registerStats } from './stats';
import type { Engine, EngineStats, InvalidateReason, Observation, RootHandle } from './types';

interface Deps {
  getWindowRect?: () => Rect;
  now?: () => number;
  measure?: (node: HostNode) => Rect | Promise<Rect>;
}

type Measured = Rect | null;
type Update = [TargetRecord, ViewportEntry];

const NOT_VISIBLE_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };
/** Quiet time after the last scroll event before the corrective full re-measure runs. */
const SETTLE_MS = 150;
/** An async measurement that has not answered by then is treated as "not measurable" (view gone). */
const ASYNC_MEASURE_TIMEOUT_MS = 250;
/** Share of measured targets off their predicted position above which the whole root is re-measured. */
const LAYOUT_SHIFT_RATIO = 0.25;
/** Reasons that only move content (scroll) or add/refresh individual targets (mount). */
const LIGHT_REASONS: InvalidateReason[] = ['scroll', 'mount'];

function defaultWindowRect(): Rect {
  // Lazy require keeps the module importable in pure-JS tests.
  const { Dimensions } = require('react-native') as typeof import('react-native');
  // 'screen', not 'window': on edge-to-edge Android (default from Android 15) 'window' excludes the system bars
  // while content is drawn under them, so 'window' would clip visible views. On iOS both are equal, and roots
  // never extend past what is drawn, so the larger rectangle is safe everywhere.
  const { width, height } = Dimensions.get('screen');
  return { x: 0, y: 0, width, height };
}

export function createJsEventEngine(deps: Deps = {}): Engine {
  const getWindowRect = deps.getWindowRect ?? defaultWindowRect;
  const now = deps.now ?? (() => Date.now());
  const measure = deps.measure ?? measureRect;

  const roots = new Map<number, RootRecord>();
  // Indexes outlive registrations so a root that unregisters and comes back (StrictMode) keeps its targets.
  const indexes = new Map<number, RootIndex>();
  const windowTargets = new Set<TargetRecord>();
  const allTargets = new Map<number, TargetRecord>();
  const stats: EngineStats = { passes: 0, measurements: 0, notifications: 0, evaluations: 0, timeMs: 0 };
  const dirtyRoots = new Map<number, PassKind>();
  const settleTimers = new Map<number, ReturnType<typeof setTimeout>>();
  let nextId = 1;
  let dirtyAll = false;
  let windowDirty = false;
  let paused = false;
  let inFlight = false;
  let rerun = false;

  const scheduler = createFrameScheduler(runPass);
  let unregisterStats: (() => void) | null = registerStats(() => ({ ...stats }));

  function revive() {
    if (!unregisterStats) unregisterStats = registerStats(() => ({ ...stats }));
  }

  function markDirty(root: RootHandle | null | undefined, kind: PassKind = 'full') {
    if (root === undefined) dirtyAll = true;
    else if (root === null) windowDirty = true;
    else dirtyRoots.set(root.id, strongest(dirtyRoots.get(root.id), kind));
    if (!paused) scheduler.request();
  }

  function clearSettle(rootId?: number) {
    settleTimers.forEach((timer, id) => {
      if (rootId === undefined || id === rootId) {
        clearTimeout(timer);
        settleTimers.delete(id);
      }
    });
  }

  /** (Re)starts the quiet-period timer that ends a scroll with one full re-measure of the root. */
  function scheduleSettle(root: RootHandle) {
    clearSettle(root.id);
    settleTimers.set(
      root.id,
      setTimeout(() => {
        settleTimers.delete(root.id);
        markDirty(root, 'settle');
      }, SETTLE_MS)
    );
  }

  function planPass(): PassPlan {
    const planned: PlannedRoot[] = [];
    [...roots.values()]
      .sort((a, b) => a.depth - b.depth)
      .forEach(record => {
        const kind = dirtyAll ? 'full' : kindFor(record, dirtyRoots);
        if (kind) planned.push(planRoot(record, kind));
      });
    const plan = { roots: planned, windowTargets: dirtyAll || windowDirty ? [...windowTargets] : [] };
    dirtyAll = false;
    windowDirty = false;
    dirtyRoots.clear();
    return plan;
  }

  function measureNode(getNode: () => HostNode | null): Measured | Promise<Measured> {
    const node = getNode();
    if (!node) return null;
    stats.measurements += 1;
    const result = measure(node);
    if (!(result instanceof Promise)) return result;
    // measureInWindow never answers for a view unmounted mid-flight; don't let one view wedge every pass.
    return new Promise<Measured>(resolve => {
      const timer = setTimeout(() => resolve(null), ASYNC_MEASURE_TIMEOUT_MS);
      result.then(
        rect => {
          clearTimeout(timer);
          resolve(rect);
        },
        () => {
          clearTimeout(timer);
          resolve(null);
        }
      );
    });
  }

  function runPass() {
    const started = Date.now();
    try {
      runPassInner();
    } finally {
      stats.timeMs += Date.now() - started;
    }
  }

  function runPassInner() {
    if (paused) return;
    if (inFlight) {
      rerun = true;
      return;
    }
    stats.passes += 1;
    const plan = planPass();
    const pending = [
      ...plan.roots.map(p => measureNode(p.record.getNode)),
      ...plan.roots.flatMap(p => p.measured.map(t => measureNode(t.getNode))),
      ...plan.windowTargets.map(t => measureNode(t.getNode)),
    ];
    if (!pending.some(p => p instanceof Promise)) {
      applyResults(plan, pending as Measured[]);
      return;
    }
    inFlight = true;
    Promise.all(pending).then(results => {
      inFlight = false;
      if (!paused) applyResults(plan, results);
      if (rerun) {
        rerun = false;
        scheduler.request();
      }
    });
  }

  function resolveRoot(record: RootRecord, rect: Measured, windowRect: Rect) {
    const parent = record.handle.parent ? roots.get(record.handle.parent.id) : null;
    if (!rect || (record.handle.parent && !parent?.effective)) {
      record.effective = null;
    } else if (parent?.effective) {
      record.effective = nestedRootRect(rect, record.margin, parent.effective);
    } else {
      record.effective = outermostRootRect(rect, windowRect, record.margin);
    }
  }

  function evaluate(target: TargetRecord, rect: Rect, bounds: Rect, time: number, updates: Update[]) {
    stats.evaluations += 1;
    const entry = computeEntry(rect, bounds, target.opts.targetMargin, time);
    const bucket = bucketOf(entry, target.opts.thresholds);
    const index = target.root ? indexes.get(target.root.id) : undefined;
    if (bucket >= 0) index?.inView.add(target);
    else index?.inView.delete(target);
    if (bucket !== target.bucket) {
      target.bucket = bucket;
      updates.push([target, entry]);
    }
  }

  function rebase(target: TargetRecord, rect: Rect, offset: { dx: number; dy: number }, index: RootIndex) {
    target.base = shift(rect, -offset.dx, -offset.dy);
    target.dirty = false;
    index.dirty.delete(target);
    index.stale = true;
  }

  /** Full pass: every target measured; bases restart at offset 0. */
  function settleFull(record: RootRecord, measured: TargetRecord[], rects: Measured[]): Array<[TargetRecord, Rect]> {
    record.offset = { dx: 0, dy: 0 };
    record.lastStep = 0;
    const evaluated: Array<[TargetRecord, Rect]> = [];
    measured.forEach((t, i) => {
      const rect = rects[i];
      t.base = rect;
      t.dirty = false;
      if (rect) evaluated.push([t, rect]);
    });
    record.index.dirty.clear();
    rebuildIndex(record.index);
    return evaluated;
  }

  const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

  /**
   * Scroll pass: the root offset is the median movement of the measured targets, so a target that moved on its own
   * (recycled cell, sticky header) cannot drag the rest with it; such targets are simply re-based. When many targets
   * disagree, layout shifted and the root is re-measured in full next frame.
   */
  function settleScroll(record: RootRecord, measured: TargetRecord[], rects: Measured[]): Array<[TargetRecord, Rect]> {
    const { index } = record;
    const moves = measured
      .map((t, i) => [t, rects[i]] as const)
      .filter(([t, rect]) => hasArea(t.base) && hasArea(rect) && !t.dirty)
      .map(([t, rect]) => ({ t, dx: rect!.x - t.base!.x, dy: rect!.y - t.base!.y }));
    if (moves.length > 0) {
      const next = { dx: median(moves.map(m => m.dx)), dy: median(moves.map(m => m.dy)) };
      record.lastStep = Math.max(Math.abs(next.dx - record.offset.dx), Math.abs(next.dy - record.offset.dy));
      record.offset = next;
    }
    const off = moves.filter(m => Math.abs(m.dx - record.offset.dx) > 1 || Math.abs(m.dy - record.offset.dy) > 1);
    if (moves.length >= 4 && off.length / moves.length > LAYOUT_SHIFT_RATIO) markDirty(record.handle, 'full');
    const evaluated: Array<[TargetRecord, Rect]> = [];
    measured.forEach((t, i) => {
      const rect = rects[i];
      if (!rect) return;
      if (!hasArea(t.base) || t.dirty || off.some(m => m.t === t)) rebase(t, rect, record.offset, index);
      evaluated.push([t, rect]);
    });
    if (index.stale) rebuildIndex(index);
    return [...evaluated, ...predictNewlyNear(record, new Set(measured))];
  }

  /** Targets that only came near with the new offset: predict now, verify with a real measurement next frame. */
  function predictNewlyNear(record: RootRecord, measured: Set<TargetRecord>): Array<[TargetRecord, Rect]> {
    if (!record.effective) return [];
    const { dx, dy } = record.offset;
    const fresh = queryRange(record.index, shift(record.effective, -dx, -dy)).filter(
      t => !measured.has(t) && hasArea(t.base)
    );
    if (fresh.length > 0) markDirty(record.handle, 'scroll');
    return fresh.map(t => [t, shift(t.base!, dx, dy)] as [TargetRecord, Rect]);
  }

  function applyResults(plan: PassPlan, results: Measured[]) {
    const windowRect = getWindowRect();
    const time = now();
    const updates: Update[] = [];
    plan.roots.forEach((p, i) => resolveRoot(p.record, results[i], windowRect));
    let cursor = plan.roots.length;
    plan.roots.forEach(({ record, kind, measured }) => {
      const rects = results.slice(cursor, cursor + measured.length);
      cursor += measured.length;
      if (!roots.has(record.handle.id)) return;
      const evaluated = kind === 'full' ? settleFull(record, measured, rects) : settleScroll(record, measured, rects);
      if (!record.effective) return;
      evaluated.forEach(([t, rect]) => {
        if (allTargets.has(t.id)) evaluate(t, rect, record.effective!, time, updates);
      });
    });
    plan.windowTargets.forEach((t, i) => {
      const rect = results[cursor + i];
      if (rect && allTargets.has(t.id)) evaluate(t, rect, windowRect, time, updates);
    });
    notify(updates);
  }

  function notify(updates: Update[]) {
    if (updates.length === 0) return;
    stats.notifications += updates.length;
    // The second argument is unused at runtime; RN >= 0.88 types require it.
    unstable_batchedUpdates(() => updates.forEach(([target, entry]) => target.cb(entry)), null);
  }

  function reportAllOut() {
    const time = now();
    const out: ViewportEntry = {
      isIntersecting: false,
      intersectionRatio: 0,
      boundingClientRect: NOT_VISIBLE_RECT,
      intersectionRect: NOT_VISIBLE_RECT,
      rootBounds: null,
      time,
    };
    const updates: Update[] = [...allTargets.values()]
      .filter(t => t.bucket !== null && t.bucket >= 0)
      .map(t => {
        t.bucket = -1;
        return [t, out];
      });
    indexes.forEach(index => index.inView.clear());
    notify(updates);
  }

  function indexFor(rootId: number): RootIndex {
    let index = indexes.get(rootId);
    if (!index) {
      index = createRootIndex();
      indexes.set(rootId, index);
    }
    return index;
  }

  /** Targets of a root that has not registered yet wait in its index and are measured once it does. */
  function addTarget(target: TargetRecord) {
    allTargets.set(target.id, target);
    if (!target.root) {
      windowTargets.add(target);
      return;
    }
    const index = indexFor(target.root.id);
    index.targets.add(target);
    index.dirty.add(target);
    index.stale = true;
  }

  function removeTarget(target: TargetRecord) {
    allTargets.delete(target.id);
    windowTargets.delete(target);
    const index = target.root ? indexes.get(target.root.id) : undefined;
    if (!index) return;
    index.targets.delete(target);
    index.inView.delete(target);
    index.dirty.delete(target);
    index.stale = true;
  }

  return {
    allocateRoot(parent) {
      return { id: nextId++, parent };
    },
    registerRoot(parent, getNode, margin, existing) {
      revive();
      const handle: RootHandle = existing ?? { id: nextId++, parent };
      const depth = parent ? (roots.get(parent.id)?.depth ?? 0) + 1 : 0;
      const index = indexFor(handle.id);
      index.targets.forEach(t => index.dirty.add(t));
      roots.set(handle.id, { handle, getNode, margin, depth, effective: null, offset: { dx: 0, dy: 0 }, lastStep: 0, index });
      markDirty(handle);
      return handle;
    },
    updateRootMargin(root, margin) {
      const record = roots.get(root.id);
      if (record) {
        record.margin = margin;
        markDirty(root);
      }
    },
    unregisterRoot(root) {
      roots.delete(root.id);
    },
    observe(getNode, root, opts, cb): Observation {
      revive();
      const target: TargetRecord = { id: nextId++, getNode, root, opts, cb, bucket: null, base: null, dirty: true };
      addTarget(target);
      markDirty(root, 'scroll');
      const refresh = () => {
        if (!allTargets.has(target.id)) return;
        target.dirty = true;
        if (target.root) indexes.get(target.root.id)?.dirty.add(target);
        markDirty(target.root, 'scroll');
      };
      return Object.assign(() => removeTarget(target), { refresh });
    },
    invalidate(reason, root) {
      if (root && reason === 'scroll-end') {
        scheduleSettle(root);
        return;
      }
      if (root && reason === 'scroll' && settleTimers.has(root.id)) scheduleSettle(root);
      markDirty(root, LIGHT_REASONS.includes(reason) ? 'scroll' : 'full');
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        scheduler.cancel();
        clearSettle();
        reportAllOut();
      } else {
        markDirty(undefined);
      }
    },
    getStats() {
      return { ...stats };
    },
    dispose() {
      scheduler.cancel();
      clearSettle();
      roots.clear();
      indexes.clear();
      allTargets.clear();
      windowTargets.clear();
      unregisterStats?.();
      unregisterStats = null;
    },
  };
}
