import { checkInViewPort, intersectRect } from "../../compat/checkInViewPort";

describe("intersectRect", () => {
  it("returns the overlapping area", () => {
    expect(
      intersectRect({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 80, width: 100, height: 100 })
    ).toEqual({ x: 50, y: 80, width: 50, height: 20 });
  });

  it("returns an empty rectangle when there is no overlap", () => {
    const result = intersectRect(
      { x: 0, y: 0, width: 100, height: 100 },
      { x: 0, y: 500, width: 100, height: 100 }
    );
    expect(result.width * result.height).toBe(0);
  });
});

const viewport = { x: 0, y: 100, width: 400, height: 600 };

describe("checkInViewPort", () => {
  it("returns true when the child is fully inside the viewport", () => {
    expect(
      checkInViewPort(viewport, { x: 0, y: 200, width: 400, height: 100 })
    ).toBe(true);
  });

  it("returns false when the child is entirely outside the viewport", () => {
    expect(
      checkInViewPort(viewport, { x: 0, y: 800, width: 400, height: 100 })
    ).toBe(false);
  });

  it("honours partial thresholds", () => {
    // Half of the child sits below the viewport's bottom edge (700).
    const child = { x: 0, y: 650, width: 400, height: 100 };
    expect(checkInViewPort(viewport, child, 1, 0.5)).toBe(true);
    expect(checkInViewPort(viewport, child, 1, 0.6)).toBe(false);
  });

  it("returns false for a zero-sized child", () => {
    expect(
      checkInViewPort(viewport, { x: 0, y: 200, width: 0, height: 0 }, 0, 0)
    ).toBe(false);
  });
});
