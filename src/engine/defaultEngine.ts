import { AppState, Dimensions } from 'react-native';
import { createJsEventEngine } from './jsEventEngine';
import type { Engine } from './types';

type EngineFactory = () => Engine;

let factory: EngineFactory | null = null;
let defaultEngine: Engine | null = null;
let unsubscribeDefault: (() => void) | null = null;

/** Test seam (used by the Jest mock entry): replaces how engines are created. */
export function __setEngineFactory(next: EngineFactory | null): void {
  factory = next;
  __resetDefaultEngine();
}

export function createEngine(): Engine {
  return factory ? factory() : createJsEventEngine();
}

/** Pauses on background and re-measures on window changes; returns the unsubscribe function. */
export function subscribeToEnvironment(engine: Engine, pauseWhenInactive: boolean): () => void {
  const subscriptions = [
    Dimensions.addEventListener('change', () => engine.invalidate('dimensions')),
    ...(pauseWhenInactive
      ? [AppState.addEventListener('change', state => engine.setPaused(state !== 'active'))]
      : []),
  ];
  return () => subscriptions.forEach(s => s.remove());
}

/** Engine for targets rendered outside any <ViewportProvider>; created on first use. */
export function getDefaultEngine(): Engine {
  if (!defaultEngine) {
    defaultEngine = createEngine();
    unsubscribeDefault = subscribeToEnvironment(defaultEngine, true);
  }
  return defaultEngine;
}

export function __resetDefaultEngine(): void {
  unsubscribeDefault?.();
  defaultEngine?.dispose();
  unsubscribeDefault = null;
  defaultEngine = null;
}
