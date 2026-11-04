import { ComponentRef, RefObject, useEffect } from 'react';
import { ScrollView } from 'react-native';

type ScrollRef = RefObject<ComponentRef<typeof ScrollView> | null>;

type Step =
  | { target: 'v' | 'h'; offset: number }
  | { target: 'v'; offset: 'end' };

// Same script as the Android recording: scroll, swipe the nested row, reach the bottom, go back.
const STEPS: Step[] = [
  { target: 'v', offset: 140 },
  { target: 'h', offset: 330 },
  { target: 'h', offset: 0 },
  { target: 'v', offset: 650 },
  { target: 'v', offset: 1100 },
  { target: 'v', offset: 'end' },
  { target: 'v', offset: 380 },
  { target: 'v', offset: 'end' },
];
const START_DELAY = 3000;
const STEP_INTERVAL = 2200;

/** Drives both scroll views on a timer so the demo runs without touch input (e.g. headless simulators). */
export function useAutoplay(
  enabled: boolean,
  vertical: ScrollRef,
  horizontal: ScrollRef
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const timers = STEPS.map((step, i) =>
      setTimeout(() => {
        if (step.offset === 'end') {
          vertical.current?.scrollToEnd({ animated: true });
        } else if (step.target === 'v') {
          vertical.current?.scrollTo({ y: step.offset, animated: true });
        } else {
          horizontal.current?.scrollTo({ x: step.offset, animated: true });
        }
      }, START_DELAY + i * STEP_INTERVAL)
    );
    return () => timers.forEach(clearTimeout);
  }, [enabled, vertical, horizontal]);
}
