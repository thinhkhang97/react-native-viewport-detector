import { LayoutRectangle } from "../types";

/**
 * Function to check if the child view is in the viewport.
 * @param {LayoutRectangle} parentView - The parent layout.
 * @param {LayoutRectangle} childView - The child layout.
 * @returns {boolean} Whether the child is in the viewport.
 */
export const checkInViewPort = (
  parentView: LayoutRectangle,
  childView: LayoutRectangle,
  percentWidth = 1,
  percentHeight = 1
) => {
  const intersectWidth = Math.abs(
    Math.min(childView.x + childView.width, parentView.x + parentView.width) -
      Math.max(childView.x, parentView.x)
  );
  const intersectHeight = Math.abs(
    Math.min(childView.y + childView.height, parentView.y + parentView.height) -
      Math.max(childView.y, parentView.y)
  );
  return (
    intersectWidth / childView.width >= percentWidth &&
    intersectHeight / childView.height >= percentHeight
  );
};
