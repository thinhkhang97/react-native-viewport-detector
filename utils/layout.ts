import { LayoutRectangle } from "../types";

/**
 * Function to check if the child view is in the viewport.
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

  // Calculate the intersection rectangle
  const intersectionLeft = Math.max(childView.x, parentView.x);
  const intersectionRight = Math.min(
    childView.x + childView.width,
    parentView.x + parentView.width
  );
  const intersectionTop = Math.max(childView.y, parentView.y);
  const intersectionBottom = Math.min(
    childView.y + childView.height,
    parentView.y + parentView.height
  );

  // If there's no intersection, return false
  if (
    intersectionRight <= intersectionLeft ||
    intersectionBottom <= intersectionTop
  ) {
    return false;
  }

  // Calculate intersection area
  const intersectionWidth = intersectionRight - intersectionLeft;
  const intersectionHeight = intersectionBottom - intersectionTop;

  // Calculate the percentage of the child that is visible
  const visibleWidthPercentage = intersectionWidth / childView.width;
  const visibleHeightPercentage = intersectionHeight / childView.height;

  // Check if the visible percentage meets the threshold
  return (
    visibleWidthPercentage >= percentWidth &&
    visibleHeightPercentage >= percentHeight
  );
};

/**
 * Returns the overlap of two rectangles; width/height are 0 when they don't overlap.
 * @param {LayoutRectangle} a - First rectangle.
 * @param {LayoutRectangle} b - Second rectangle.
 * @returns {LayoutRectangle} The intersection rectangle.
 */
export const intersectRect = (
  a: LayoutRectangle,
  b: LayoutRectangle
): LayoutRectangle => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(0, Math.min(a.x + a.width, b.x + b.width) - x),
    height: Math.max(0, Math.min(a.y + a.height, b.y + b.height) - y),
  };
};
