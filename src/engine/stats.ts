import type { EngineStats } from './types';

type StatsSource = () => EngineStats;

const sources = new Set<StatsSource>();

export function registerStats(source: StatsSource): () => void {
  sources.add(source);
  return () => sources.delete(source);
}

/** Dev/benchmark only: counters summed over every live engine. */
export function __getAllStats(): EngineStats {
  const total: EngineStats = { passes: 0, measurements: 0, notifications: 0, evaluations: 0, timeMs: 0 };
  sources.forEach(source => {
    const s = source();
    total.passes += s.passes;
    total.measurements += s.measurements;
    total.notifications += s.notifications;
    total.evaluations += s.evaluations;
    total.timeMs += s.timeMs;
  });
  return total;
}
