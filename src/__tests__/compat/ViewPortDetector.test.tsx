import React from "react";
import { View } from "react-native";
import { act, render, screen } from "@testing-library/react-native";
import { ViewPortDetector } from "../../compat/ViewPortDetector";
import { ViewPortDetectorProvider } from "../../compat/ViewPortDetectorProvider";
import { LayoutRectangle } from "../../types";

const PROVIDER_ID = "provider";
const DETECTOR_ID = "detector";
const FREQUENCY = 500;

// Window-space rectangles returned by the mocked `measureInWindow`, keyed by testID.
let windowRects: Record<string, LayoutRectangle> = {};

const setRect = (testID: string, rect: LayoutRectangle) => {
  windowRects = { ...windowRects, [testID]: rect };
};

type MeasureCallback = (x: number, y: number, w: number, h: number) => void;

const measureInWindow = jest.spyOn(
  View.prototype as unknown as {
    measureInWindow: (cb: MeasureCallback) => void;
  },
  "measureInWindow"
);

const tick = (ms = FREQUENCY) =>
  act(() => {
    jest.advanceTimersByTime(ms);
  });

const renderInProvider = (detector: React.ReactElement) =>
  render(
    <ViewPortDetectorProvider testID={PROVIDER_ID}>{detector}</ViewPortDetectorProvider>
  );

beforeEach(() => {
  jest.useFakeTimers();
  windowRects = {};
  measureInWindow.mockImplementation(function (
    this: { props: { testID?: string } },
    callback: MeasureCallback
  ) {
    const rect = windowRects[this.props.testID ?? ""];
    if (rect) {
      callback(rect.x, rect.y, rect.width, rect.height);
    }
  });
});

afterEach(() => {
  jest.useRealTimers();
  measureInWindow.mockReset();
});

describe("ViewPortDetector", () => {
  it("compares the child against the provider in window coordinates", () => {
    // Provider sits below a 47pt inset + 60pt header; the child is flush with its bottom edge.
    setRect(PROVIDER_ID, { x: 0, y: 107, width: 390, height: 700 });
    setRect(DETECTOR_ID, { x: 0, y: 767, width: 390, height: 40 });
    const onChange = jest.fn();

    renderInProvider(
      <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={FREQUENCY}>
        <View />
      </ViewPortDetector>
    );
    tick();

    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("re-measures the provider on every check, so nested/scrolling providers stay correct", () => {
    setRect(PROVIDER_ID, { x: 0, y: 2000, width: 390, height: 120 });
    setRect(DETECTOR_ID, { x: 0, y: 300, width: 120, height: 120 });
    const onChange = jest.fn();

    renderInProvider(
      <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={FREQUENCY}>
        <View />
      </ViewPortDetector>
    );
    tick();
    expect(onChange).toHaveBeenLastCalledWith(false);

    // The outer list scrolls: provider and child move together onto the screen.
    setRect(PROVIDER_ID, { x: 0, y: 300, width: 390, height: 120 });
    tick();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("clips a nested provider to its parent provider's viewport", () => {
    const OUTER_ID = "outer";
    // The nested provider (and its child) sit below the outer viewport, off screen.
    setRect(OUTER_ID, { x: 0, y: 0, width: 390, height: 800 });
    setRect(PROVIDER_ID, { x: 0, y: 1200, width: 390, height: 120 });
    setRect(DETECTOR_ID, { x: 0, y: 1200, width: 120, height: 120 });
    const onChange = jest.fn();

    render(
      <ViewPortDetectorProvider testID={OUTER_ID}>
        <ViewPortDetectorProvider testID={PROVIDER_ID}>
          <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={FREQUENCY}>
            <View />
          </ViewPortDetector>
        </ViewPortDetectorProvider>
      </ViewPortDetectorProvider>
    );
    tick();
    expect(onChange).toHaveBeenLastCalledWith(false);

    // The outer list scrolls the nested row on screen.
    setRect(PROVIDER_ID, { x: 0, y: 300, width: 390, height: 120 });
    setRect(DETECTOR_ID, { x: 0, y: 300, width: 120, height: 120 });
    tick();
    expect(onChange).toHaveBeenLastCalledWith(true);
  });

  it("only calls onChange when the visibility actually changes", () => {
    setRect(PROVIDER_ID, { x: 0, y: 0, width: 400, height: 800 });
    setRect(DETECTOR_ID, { x: 0, y: 100, width: 400, height: 100 });
    const onChange = jest.fn();

    renderInProvider(
      <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={FREQUENCY}>
        <View />
      </ViewPortDetector>
    );
    tick();
    tick();
    tick();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("stops checking after the first visible report when runOnce is set", () => {
    setRect(PROVIDER_ID, { x: 0, y: 0, width: 400, height: 800 });
    setRect(DETECTOR_ID, { x: 0, y: 100, width: 400, height: 100 });
    const onChange = jest.fn();

    renderInProvider(
      <ViewPortDetector
        testID={DETECTOR_ID}
        onChange={onChange}
        frequency={FREQUENCY}
        runOnce
      >
        <View />
      </ViewPortDetector>
    );
    tick();
    expect(onChange).toHaveBeenCalledWith(true);

    measureInWindow.mockClear();
    setRect(DETECTOR_ID, { x: 0, y: 2000, width: 400, height: 100 });
    tick();
    tick();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(measureInWindow).not.toHaveBeenCalled();
  });

  it("does not measure while disabled and starts once enabled", () => {
    setRect(PROVIDER_ID, { x: 0, y: 0, width: 400, height: 800 });
    setRect(DETECTOR_ID, { x: 0, y: 100, width: 400, height: 100 });
    const onChange = jest.fn();
    const detector = (enabled: boolean) => (
      <ViewPortDetector
        testID={DETECTOR_ID}
        onChange={onChange}
        frequency={FREQUENCY}
        enabled={enabled}
      >
        <View />
      </ViewPortDetector>
    );

    const { rerender } = renderInProvider(detector(false));
    tick();
    tick();
    expect(onChange).not.toHaveBeenCalled();

    rerender(
      <ViewPortDetectorProvider testID={PROVIDER_ID}>{detector(true)}</ViewPortDetectorProvider>
    );
    tick();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("calls the latest onChange without needing a stable callback", () => {
    setRect(PROVIDER_ID, { x: 0, y: 0, width: 400, height: 800 });
    setRect(DETECTOR_ID, { x: 0, y: 2000, width: 400, height: 100 });
    const first = jest.fn();
    const second = jest.fn();
    const detector = (onChange: (v: boolean) => void) => (
      <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={FREQUENCY}>
        <View />
      </ViewPortDetector>
    );

    const { rerender } = renderInProvider(detector(first));
    tick();
    rerender(
      <ViewPortDetectorProvider testID={PROVIDER_ID}>{detector(second)}</ViewPortDetectorProvider>
    );
    setRect(DETECTOR_ID, { x: 0, y: 100, width: 400, height: 100 });
    tick();

    expect(first).toHaveBeenCalledTimes(1);
    expect(first).toHaveBeenCalledWith(false);
    expect(second).toHaveBeenCalledWith(true);
  });

  it("falls back to the window when there is no provider", () => {
    setRect(DETECTOR_ID, { x: 0, y: 100, width: 100, height: 100 });
    const onChange = jest.fn();

    render(
      <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={FREQUENCY}>
        <View />
      </ViewPortDetector>
    );
    tick();

    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("disables view flattening and applies style props through style", () => {
    renderInProvider(
      <ViewPortDetector testID={DETECTOR_ID} onChange={jest.fn()} flex={1} style={{ margin: 4 }}>
        <View />
      </ViewPortDetector>
    );
    const host = screen.getByTestId(DETECTOR_ID);

    expect(host.props.collapsable).toBe(false);
    expect(host).toHaveStyle({ flex: 1, margin: 4 });
    expect(host.props.flex).toBeUndefined();
  });

  it("falls back to the default frequency when given a non-positive one", () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
    setRect(PROVIDER_ID, { x: 0, y: 0, width: 400, height: 800 });
    setRect(DETECTOR_ID, { x: 0, y: 100, width: 400, height: 100 });
    const onChange = jest.fn();

    renderInProvider(
      <ViewPortDetector testID={DETECTOR_ID} onChange={onChange} frequency={0}>
        <View />
      </ViewPortDetector>
    );
    measureInWindow.mockClear();
    tick(999);

    expect(warn).toHaveBeenCalled();
    expect(measureInWindow.mock.calls.length).toBeLessThanOrEqual(4);
    warn.mockRestore();
  });
});
