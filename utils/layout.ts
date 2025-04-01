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
