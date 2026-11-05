import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getDefaultEngine } from '../engine/defaultEngine';
import type { Engine, Observation, RootHandle } from '../engine/types';
import { normalizeMargin } from '../geometry';
import type { HostNode } from '../measure';
import { bucketOf, isInView, normalizeThresholds, thresholdsKey } from '../thresholds';
import type { MarginInput, ViewportEntry } from '../types';
import { warnOnce } from '../warnOnce';
import { ViewportContext } from './context';

export interface UseInViewOptions {
  /** Ratio(s) of the target's area that must be visible; default 0. */
  threshold?: number | number[];
  /** Pixels added around the nearest root for this target only. */
  rootMargin?: MarginInput;
  /** Stop observing after the first time the target is in view. */
  triggerOnce?: boolean;
  /** Pause observing (e.g. `skip={!isFocused}`); the last state is kept. */
  skip?: boolean;
  /** Value before the first measurement. */
  initialInView?: boolean;
  /** Milliseconds the target must stay in view before `inView` becomes true. */
  delay?: number;
  onChange?: (inView: boolean, entry: ViewportEntry) => void;
  /** Pass `null` on intentionally static screens to measure against the window without a provider warning. */
  root?: null;
}

export type InViewRef = (node: object | null) => void;

export type InViewResult = [InViewRef, boolean, ViewportEntry | undefined] & {
  ref: InViewRef;
  inView: boolean;
  entry?: ViewportEntry;
};

interface InViewState {
  inView: boolean;
  entry?: ViewportEntry;
}

const NO_PROVIDER_WARNING =
  'useInView: no <ViewportProvider> found — scrolling will not be tracked. ' +
  'Wrap your scroll view in <ViewportProvider> or pass root={null} for static screens.';

function useTarget(options: UseInViewOptions): { engine: Engine; root: RootHandle | null } {
  const ctx = useContext(ViewportContext);
  if (!ctx && options.root !== null) {
    warnOnce('no-root', NO_PROVIDER_WARNING);
  }
  return {
    engine: ctx?.engine ?? getDefaultEngine(),
    root: options.root === null ? null : (ctx?.root ?? null),
  };
}

/**
 * Shared implementation of `useInView` and `<InView>`; also exposes `invalidate` for `<InView>`'s onLayout.
 * With `trackState: false` the component never re-renders on visibility changes (only `onChange` runs) —
 * `<InView>` uses this when its children are plain nodes and nobody reads the state.
 */
export function useInViewState(options: UseInViewOptions, { trackState = true }: { trackState?: boolean } = {}) {
  const { engine, root } = useTarget(options);
  const thresholds = normalizeThresholds(options.threshold);
  const tKey = thresholdsKey(thresholds);
  const margin = normalizeMargin(options.rootMargin);
  const mKey = `${margin.top},${margin.right},${margin.bottom},${margin.left}`;
  const [state, setState] = useState<InViewState>({ inView: options.initialInView ?? false });
  const [done, setDone] = useState(false);
  const nodeRef = useRef<HostNode | null>(null);
  const observationRef = useRef<Observation | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const trackStateRef = useRef(trackState);
  trackStateRef.current = trackState;

  const ref = useCallback<InViewRef>(
    node => {
      nodeRef.current = node as HostNode | null;
      // A view can attach after the first pass (conditional rendering): measure this target itself.
      if (node) {
        if (observationRef.current) observationRef.current.refresh();
        else engine.invalidate('mount', root);
      }
    },
    [engine, root]
  );

  useEffect(() => {
    if (options.skip || done) return undefined;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;
    const commit = (inView: boolean, entry: ViewportEntry) => {
      if (!active) return;
      if (trackStateRef.current) setState({ inView, entry });
      latest.current.onChange?.(inView, entry);
      if (inView && latest.current.triggerOnce) setDone(true);
    };
    const onEntry = (entry: ViewportEntry) => {
      const inView = isInView(bucketOf(entry, normalizeThresholds(latest.current.threshold)));
      const delay = latest.current.delay ?? 0;
      if (!inView || delay <= 0) {
        if (timer) clearTimeout(timer);
        timer = null;
        commit(inView, entry);
      } else if (!timer) {
        timer = setTimeout(() => {
          timer = null;
          commit(true, entry);
        }, delay);
      }
    };
    const opts = { thresholds: normalizeThresholds(latest.current.threshold), targetMargin: normalizeMargin(latest.current.rootMargin) };
    const observation = engine.observe(() => nodeRef.current, root, opts, onEntry);
    observationRef.current = observation;
    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      observationRef.current = null;
      observation();
    };
  }, [engine, root, tKey, mKey, options.skip, done]);

  // The target's own layout changed: re-measure just this target, not the whole root.
  const invalidate = useCallback(() => observationRef.current?.refresh(), []);
  return { ref, inView: state.inView, entry: state.entry, invalidate };
}

/** Tracks whether the element attached to `ref` is visible inside the nearest `<ViewportProvider>`. */
export function useInView(options: UseInViewOptions = {}): InViewResult {
  const { ref, inView, entry } = useInViewState(options);
  return useMemo(() => {
    const result = [ref, inView, entry] as InViewResult;
    result.ref = ref;
    result.inView = inView;
    result.entry = entry;
    return result;
  }, [ref, inView, entry]);
}
