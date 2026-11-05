/**
 * Test helpers for components that use react-native-viewport-detector.
 *
 *   import { setupViewportMock, mockAllInView, mockInView, resetViewportMock } from 'react-native-viewport-detector/jest';
 *   beforeEach(() => setupViewportMock());
 *   afterEach(() => resetViewportMock());
 *   act(() => mockInView('card-2', 0.5));
 */
import { __setEngineFactory } from '../engine/defaultEngine';
import type { Engine, EntryCallback } from '../engine/types';
import type { HostNode } from '../measure';
import type { ViewportEntry } from '../types';

interface MockTarget {
  getNode: () => HostNode | null;
  cb: EntryCallback;
}

const ZERO = { x: 0, y: 0, width: 0, height: 0 };

let targets: Set<MockTarget> | null = null;
let allValue: boolean | number | null = null;

function entryFor(value: boolean | number): ViewportEntry {
  const ratio = typeof value === 'number' ? Math.min(1, Math.max(0, value)) : value ? 1 : 0;
  return {
    isIntersecting: ratio > 0,
    intersectionRatio: ratio,
    boundingClientRect: ZERO,
    intersectionRect: ZERO,
    rootBounds: null,
    time: Date.now(),
  };
}

function createMockEngine(): Engine {
  let nextId = 1;
  return {
    allocateRoot: parent => ({ id: nextId++, parent }),
    registerRoot: (parent, _getNode, _margin, existing) => existing ?? { id: nextId++, parent },
    updateRootMargin: () => {},
    unregisterRoot: () => {},
    observe(getNode, _root, _opts, cb) {
      const target = { getNode, cb };
      targets?.add(target);
      if (allValue !== null) cb(entryFor(allValue));
      return Object.assign(
        () => {
          targets?.delete(target);
        },
        { refresh: () => {} }
      );
    },
    invalidate: () => {},
    setPaused: () => {},
    getStats: () => ({ passes: 0, measurements: 0, notifications: 0, evaluations: 0, timeMs: 0 }),
    dispose: () => {},
  };
}

function requireSetup(): Set<MockTarget> {
  if (!targets) {
    throw new Error('react-native-viewport-detector/jest: call setupViewportMock() before mocking visibility.');
  }
  return targets;
}

function testIdOf(target: MockTarget): string | undefined {
  return (target.getNode() as { props?: { testID?: string } } | null)?.props?.testID;
}

/** Replaces the visibility engine with a controllable mock. Call in `beforeEach`. */
export function setupViewportMock(): void {
  targets = new Set();
  allValue = null;
  __setEngineFactory(createMockEngine);
}

/** Every observed target (and any mounted later) becomes visible (`true`/ratio) or hidden (`false`/0). */
export function mockAllInView(value: boolean | number): void {
  const current = requireSetup();
  allValue = value;
  current.forEach(target => target.cb(entryFor(value)));
}

/** Only targets whose host view has this `testID`. */
export function mockInView(testID: string, value: boolean | number): void {
  requireSetup().forEach(target => {
    if (testIdOf(target) === testID) target.cb(entryFor(value));
  });
}

/** Restores the real engine. Call in `afterEach`. */
export function resetViewportMock(): void {
  targets = null;
  allValue = null;
  __setEngineFactory(null);
}
