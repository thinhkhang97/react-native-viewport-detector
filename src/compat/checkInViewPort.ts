import { intersect } from '../geometry';
import type { LayoutRectangle } from '../types';

/**
 * v1 visibility check: each axis must show at least the given share of the child.
 * @param {LayoutRectangle} parentView - The parent layout.
 * @param {LayoutRectangle} childView - The child layout.
 * @param {number} percentWidth - Minimum percentage of width that must be visible
 * @param {number} percentHeight - Minimum percentage of height that must be visible
 * @returns {boolean} Whether the child is in the viewport.
 */
export const checkInViewPort = (
  parentView: LayoutRectangle,
  childView: LayoutRectangle,
  percentWidth = 1,
  percentHeight = 1
) => {
  // A zero-sized child (e.g. not laid out yet) can never be visible
  if (childView.width <= 0 || childView.height <= 0) {
    return false;
  }
  const overlap = intersect(parentView, childView);
  if (overlap.width === 0) {
    return false;
  }
  return (
    overlap.width / childView.width >= percentWidth &&
    overlap.height / childView.height >= percentHeight
  );
};

/** v1 name for {@link intersect}. */
export const intersectRect = intersect;
