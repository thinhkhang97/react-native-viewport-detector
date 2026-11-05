import { useCallback, useRef } from 'react';
import type { ScrollView } from 'react-native';
import { LIST_PADDING, ROW_GAP, ROW_HEIGHT, type Report } from './adapters';

export const SETTLE_AFTER_MOUNT_MS = 2000;
export const IDLE_MS = 2000;
export const SCROLL_MS = 5000;
export const SCROLL_SPEED = 1500; // px per second
export const SETTLE_MS = 1000;

export interface BenchResult {
  frameAvg: number;
  frameP95: number;
  droppedPct: number;
  /** Average share of truly visible rows that were reported wrong while scrolling. */
  stalePct: number;
  /** Rows still reported wrong 1 s after scrolling stopped. */
  settledErrors: number;
  idleFrameAvg: number;
  /** Diagnostics: viewport height, last commanded offset and last offset reported by onScroll. */
  debug: string;
}

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const round = (n: number) => Math.round(n * 10) / 10;

function percentile(values: number[], p: number) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0;
}

function truthRange(offset: number, viewport: number, count: number): [number, number] {
  const step = ROW_HEIGHT + ROW_GAP;
  const first = Math.max(0, Math.floor((offset - LIST_PADDING - ROW_HEIGHT) / step) + 1);
  const last = Math.min(count - 1, Math.floor((offset + viewport - LIST_PADDING) / step));
  return [first, last];
}

/** Drives a deterministic programmatic scroll and scores a library against the known layout. */
export function useBenchRun(count: number) {
  const reported = useRef(new Set<number>());
  const scrollRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const viewport = useRef(0);
  const actualOffset = useRef(0);
  const scrollEvents = useRef(0);
  const maxSeen = useRef(0);

  const report = useCallback<Report>((index, visible) => {
    if (visible) reported.current.add(index);
    else reported.current.delete(index);
  }, []);

  const mismatches = useCallback(
    (offset: number) => {
      const [first, last] = truthRange(offset, viewport.current, count);
      let wrong = 0;
      for (let i = first; i <= last; i++) if (!reported.current.has(i)) wrong++;
      reported.current.forEach(i => {
        if (i < first || i > last) wrong++;
      });
      return { wrong, visible: last - first + 1 };
    },
    [count]
  );

  const frames = (ms: number, onFrame: (t: number) => void) =>
    new Promise<number[]>(resolve => {
      const deltas: number[] = [];
      const start = performance.now();
      let last = start;
      const tick = (now: number) => {
        deltas.push(now - last);
        last = now;
        onFrame(now - start);
        if (now - start < ms) requestAnimationFrame(tick);
        else resolve(deltas.slice(1));
      };
      requestAnimationFrame(tick);
    });

  const run = useCallback(async (): Promise<BenchResult> => {
    await wait(SETTLE_AFTER_MOUNT_MS);
    const idle = await frames(IDLE_MS, () => {});
    const maxOffset = 2 * LIST_PADDING + count * (ROW_HEIGHT + ROW_GAP) - viewport.current;
    let previous = 0;
    const stale: number[] = [];
    const scroll = await frames(SCROLL_MS, t => {
      // Ground truth uses the offset the native side last reported, not the one we asked for.
      const m = mismatches(actualOffset.current);
      stale.push(m.visible > 0 ? m.wrong / m.visible : 0);
      previous = Math.min(maxOffset, (SCROLL_SPEED * t) / 1000);
      scrollRef.current?.scrollTo({ y: previous, animated: false });
    });
    await wait(SETTLE_MS);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
    return {
      frameAvg: round(avg(scroll)),
      frameP95: round(percentile(scroll, 0.95)),
      droppedPct: round((scroll.filter(d => d > 25).length / Math.max(1, scroll.length)) * 100),
      stalePct: round(avg(stale) * 100),
      settledErrors: mismatches(actualOffset.current).wrong,
      idleFrameAvg: round(avg(idle)),
      debug: `vh ${Math.round(viewport.current)} cmd ${Math.round(previous)} actual ${Math.round(actualOffset.current)} max ${Math.round(maxSeen.current)} ev ${scrollEvents.current}`,
    };
  }, [count, mismatches]);

  const reset = useCallback(() => {
    reported.current.clear();
    actualOffset.current = 0;
    scrollEvents.current = 0;
    maxSeen.current = 0;
  }, []);
  const onScroll = useCallback((y: number) => {
    actualOffset.current = y;
    scrollEvents.current += 1;
    maxSeen.current = Math.max(maxSeen.current, y);
  }, []);
  const onLayout = useCallback((h: number) => (viewport.current = h), []);

  return { report, scrollRef, onLayout, onScroll, run, reset };
}
