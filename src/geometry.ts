import type { Margin, MarginInput, Rect, ViewportEntry } from './types';

export function normalizeMargin(margin?: MarginInput): Margin {
  if (typeof margin === 'number') {
    return { top: margin, right: margin, bottom: margin, left: margin };
  }
  return {
    top: margin?.top ?? 0,
    right: margin?.right ?? 0,
    bottom: margin?.bottom ?? 0,
    left: margin?.left ?? 0,
  };
}

/** Overlap of two rectangles; width/height are 0 when they don't overlap. */
export function intersect(a: Rect, b: Rect): Rect {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  if (width <= 0 || height <= 0) {
    return { x, y, width: 0, height: 0 };
  }
  return { x, y, width, height };
}

/** Grows a rectangle by a margin; negative values shrink it. */
export function expand(rect: Rect, margin: Margin): Rect {
  return {
    x: rect.x - margin.left,
    y: rect.y - margin.top,
    width: Math.max(0, rect.width + margin.left + margin.right),
    height: Math.max(0, rect.height + margin.top + margin.bottom),
  };
}

export function area(rect: Rect): number {
  return rect.width * rect.height;
}

/** The margin is applied after window clipping so preload margins can reach past the screen edge. */
export function outermostRootRect(rootRect: Rect, windowRect: Rect, margin: Margin): Rect {
  return expand(intersect(rootRect, windowRect), margin);
}

/** A nested root can never see more than its ancestors allow. */
export function nestedRootRect(rootRect: Rect, margin: Margin, parentEffective: Rect): Rect {
  return intersect(expand(rootRect, margin), parentEffective);
}

export function computeEntry(
  target: Rect,
  rootBounds: Rect,
  targetMargin: Margin,
  time: number
): ViewportEntry {
  const clip = expand(rootBounds, targetMargin);
  const intersectionRect = intersect(target, clip);
  const targetArea = area(target);
  const isIntersecting = intersectionRect.width > 0 && intersectionRect.height > 0;
  return {
    isIntersecting,
    intersectionRatio: isIntersecting && targetArea > 0 ? area(intersectionRect) / targetArea : 0,
    boundingClientRect: target,
    intersectionRect,
    rootBounds: clip,
    time,
  };
}
