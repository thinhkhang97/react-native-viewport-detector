export { ViewportProvider, type ViewportProviderProps } from './react/ViewportProvider';
export {
  useViewportRoot,
  type ViewportRoot,
  type ViewportRootOptions,
  type ViewportScrollProps,
} from './react/useViewportRoot';
export { useInView, type InViewRef, type InViewResult, type UseInViewOptions } from './react/useInView';
export { InView, type InViewProps } from './react/InView';
export { unstable_setMeasureMode, type MeasureMode } from './measure';
export type { Margin, MarginInput, Rect, ViewportEntry } from './types';
export type { InViewOptions } from './types';

// v1 API — deprecated, removed in v3 (see docs/MIGRATION.md).
export * from './compat';
export type { LayoutRectangle } from './types';
