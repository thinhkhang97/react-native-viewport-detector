import { useEffect, useMemo, useRef } from 'react';

type Phase = 'touch' | 'drag' | 'momentum';

export interface NativeScrollFallbackHandlers {
  onTouchStart: () => void;
  onTouchEnd: () => void;
  onScrollBeginDrag: () => void;
  onScrollEndDrag: () => void;
  onMomentumScrollBegin: () => void;
  onMomentumScrollEnd: () => void;
}

/**
 * With a native-driver `Animated.event`, JS never sees `onScroll`. Instead, re-check once per frame while a touch,
 * drag or momentum phase is active, and stop as soon as all of them have ended.
 */
export function useNativeScrollFallback(enabled: boolean, tick: () => void): NativeScrollFallbackHandlers | null {
  const active = useRef(new Set<Phase>());
  const frame = useRef<number | null>(null);
  const tickRef = useRef(tick);
  tickRef.current = tick;

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  return useMemo(() => {
    if (!enabled) return null;
    const loop = () => {
      frame.current = null;
      if (active.current.size === 0) return;
      tickRef.current();
      frame.current = requestAnimationFrame(loop);
    };
    const begin = (phase: Phase) => () => {
      active.current.add(phase);
      if (frame.current === null) frame.current = requestAnimationFrame(loop);
    };
    const end = (phase: Phase) => () => {
      active.current.delete(phase);
      tickRef.current();
      if (active.current.size === 0 && frame.current !== null) {
        cancelAnimationFrame(frame.current);
        frame.current = null;
      }
    };
    return {
      onTouchStart: begin('touch'),
      onTouchEnd: end('touch'),
      onScrollBeginDrag: begin('drag'),
      onScrollEndDrag: end('drag'),
      onMomentumScrollBegin: begin('momentum'),
      onMomentumScrollEnd: end('momentum'),
    };
  }, [enabled]);
}
