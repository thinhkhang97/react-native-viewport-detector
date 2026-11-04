import React, { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createEngine, subscribeToEnvironment } from '../engine/defaultEngine';
import type { Engine, RootHandle } from '../engine/types';
import { normalizeMargin } from '../geometry';
import type { HostNode } from '../measure';
import type { MarginInput } from '../types';
import { ViewportContext } from './context';

export interface ViewportRootOptions {
  rootMargin?: MarginInput;
  /** Top-level roots only: pause and report everything out while the app is in the background. */
  pauseWhenInactive?: boolean;
  /** 'auto' resolves to 'js' in v2.0. */
  engine?: 'auto' | 'js';
}

export interface ViewportScrollProps {
  onScroll: () => void;
  onLayout: () => void;
  onContentSizeChange: () => void;
  onMomentumScrollEnd: () => void;
  onScrollEndDrag: () => void;
  scrollEventThrottle: 16;
}

export interface ViewportRoot {
  /** Attach to the scroll container (any host-backed component: ScrollView, FlatList, FlashList, ...). */
  ref: (node: object | null) => void;
  handle: RootHandle;
  scrollProps: ViewportScrollProps;
  invalidate: () => void;
  Provider: React.FC<{ children?: React.ReactNode }>;
}

function useOwnedEngine(parentEngine: Engine | null, pauseWhenInactive: boolean): Engine {
  const [owned] = useState<Engine | null>(() => (parentEngine ? null : createEngine()));
  // Disposed only on unmount; changing pauseWhenInactive just re-subscribes.
  useEffect(() => (owned ? () => owned.dispose() : undefined), [owned]);
  useEffect(() => (owned ? subscribeToEnvironment(owned, pauseWhenInactive) : undefined), [owned, pauseWhenInactive]);
  return parentEngine ?? owned!;
}

/** Registers a scroll container as a visibility root. Spread `scrollProps` and attach `ref` to it. */
export function useViewportRoot(options: ViewportRootOptions = {}): ViewportRoot {
  const parent = useContext(ViewportContext);
  const engine = useOwnedEngine(parent?.engine ?? null, options.pauseWhenInactive ?? true);
  const nodeRef = useRef<HostNode | null>(null);
  const margin = normalizeMargin(options.rootMargin);
  const marginKey = `${margin.top},${margin.right},${margin.bottom},${margin.left}`;
  const getNode = useCallback(() => nodeRef.current, []);
  // Only an id is reserved during render; registration happens in an effect (safe under StrictMode/concurrency).
  const [handle] = useState(() => engine.allocateRoot(parent?.root ?? null));
  const marginRef = useRef(margin);
  marginRef.current = margin;

  useEffect(() => {
    engine.registerRoot(handle.parent, getNode, marginRef.current, handle);
    return () => engine.unregisterRoot(handle);
  }, [engine, handle, getNode]);

  useEffect(() => {
    engine.updateRootMargin(handle, marginRef.current);
  }, [engine, handle, marginKey]);

  const ref = useCallback(
    (node: object | null) => {
      nodeRef.current = node as HostNode | null;
      if (node) engine.invalidate('layout', handle);
    },
    [engine, handle]
  );

  const scrollProps = useMemo<ViewportScrollProps>(() => {
    const on = (reason: 'scroll' | 'scroll-end' | 'layout' | 'content-size') => () =>
      engine.invalidate(reason, handle);
    return {
      onScroll: on('scroll'),
      onLayout: on('layout'),
      onContentSizeChange: on('content-size'),
      // Scroll passes translate cached rects; a full pass at the end corrects any drift.
      onMomentumScrollEnd: on('scroll-end'),
      onScrollEndDrag: on('scroll-end'),
      scrollEventThrottle: 16,
    };
  }, [engine, handle]);

  const invalidate = useCallback(() => engine.invalidate('manual', handle), [engine, handle]);
  const value = useMemo(() => ({ engine, root: handle }), [engine, handle]);
  const Provider = useMemo<ViewportRoot['Provider']>(
    () =>
      function ViewportRootProvider({ children }) {
        return <ViewportContext.Provider value={value}>{children}</ViewportContext.Provider>;
      },
    [value]
  );

  return { ref, handle, scrollProps, invalidate, Provider };
}
