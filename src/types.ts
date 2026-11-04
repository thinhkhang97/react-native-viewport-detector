export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/** @deprecated v1 name for {@link Rect}. */
export type LayoutRectangle = Rect;

export type Margin = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type MarginInput = number | Partial<Margin>;

export interface ViewportEntry {
  isIntersecting: boolean;
  /** 0..1, share of the target's area that is visible. */
  intersectionRatio: number;
  /** Target rectangle in window coordinates. */
  boundingClientRect: Rect;
  intersectionRect: Rect;
  /** Effective root after margins and ancestor clipping. */
  rootBounds: Rect | null;
  time: number;
}

/** Options shared by `useInView` and `<InView>`. */
export type { UseInViewOptions as InViewOptions } from './react/useInView';
