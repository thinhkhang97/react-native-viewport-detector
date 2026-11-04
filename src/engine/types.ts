import type { HostNode } from '../measure';
import type { Margin, ViewportEntry } from '../types';

export type InvalidateReason =
  | 'scroll'
  | 'scroll-end'
  | 'layout'
  | 'content-size'
  | 'app-state'
  | 'dimensions'
  | 'mount'
  | 'options'
  | 'manual';

export interface NormalizedOptions {
  thresholds: number[];
  targetMargin: Margin;
}

export interface RootHandle {
  readonly id: number;
  readonly parent: RootHandle | null;
}

export interface EngineStats {
  passes: number;
  measurements: number;
  notifications: number;
  /** Target entries computed (scroll passes skip targets far from the viewport). */
  evaluations: number;
  /** Milliseconds of JS time spent inside passes (benchmark/dev only). */
  timeMs: number;
}

export type EntryCallback = (entry: ViewportEntry) => void;

/** Call to stop observing; `refresh()` re-measures just this target (e.g. after its own layout changed). */
export interface Observation {
  (): void;
  refresh(): void;
}

export interface Engine {
  /** Reserves a root id without registering it (targets may observe it before it registers). */
  allocateRoot(parent: RootHandle | null): RootHandle;
  registerRoot(
    parent: RootHandle | null,
    getNode: () => HostNode | null,
    margin: Margin,
    existing?: RootHandle
  ): RootHandle;
  updateRootMargin(root: RootHandle, margin: Margin): void;
  unregisterRoot(root: RootHandle): void;
  observe(
    getNode: () => HostNode | null,
    root: RootHandle | null,
    opts: NormalizedOptions,
    cb: EntryCallback
  ): Observation;
  /** Root omitted = everything. */
  invalidate(reason: InvalidateReason, root?: RootHandle | null): void;
  setPaused(paused: boolean): void;
  getStats(): EngineStats;
  dispose(): void;
}
