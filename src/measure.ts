import type { Rect } from './types';
import { warnOnce } from './warnOnce';

export type HostNode = {
  getBoundingClientRect?: () => { x: number; y: number; width: number; height: number };
  measureInWindow?: (callback: (x: number, y: number, width: number, height: number) => void) => void;
};

export type MeasureMode = 'auto' | 'async';

// Measured 2026-11-04 (spec §12): sync reads are fresh enough on both iOS and Android.
const DEFAULT_MEASURE_MODE: MeasureMode = 'auto';
const ZERO_RECT: Rect = { x: 0, y: 0, width: 0, height: 0 };

let mode: MeasureMode = DEFAULT_MEASURE_MODE;

/** Forces the async `measureInWindow` path (used to QA RN < 0.82 behaviour on new devices). */
export function unstable_setMeasureMode(next: MeasureMode): void {
  mode = next;
}

export function getMeasureMode(): MeasureMode {
  return mode;
}

function reportFailure(error: unknown): Rect {
  warnOnce(
    'measure-failed',
    `react-native-viewport-detector: could not measure a view (${error instanceof Error ? error.message : String(error)}); treating it as not visible.`
  );
  return ZERO_RECT;
}

function measureAsync(node: HostNode): Promise<Rect> {
  return new Promise(resolve => {
    try {
      node.measureInWindow!((x, y, width, height) => resolve({ x, y, width, height }));
    } catch (error) {
      resolve(reportFailure(error));
    }
  });
}

/** Window-space rectangle of a host view: synchronous when the runtime allows it, otherwise a Promise. */
export function measureRect(node: HostNode): Rect | Promise<Rect> {
  if (mode === 'auto' && typeof node.getBoundingClientRect === 'function') {
    try {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { x, y, width, height };
    } catch (error) {
      return reportFailure(error);
    }
  }
  if (typeof node.measureInWindow === 'function') {
    return measureAsync(node);
  }
  return ZERO_RECT;
}
