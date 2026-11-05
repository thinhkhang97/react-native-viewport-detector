import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import {
  StyleProp,
  View,
  ViewStyle,
  useWindowDimensions,
} from "react-native";
import { LayoutRectangle } from "../types";
import { checkInViewPort } from "./checkInViewPort";
import { ViewPortDetectorContext } from "./ViewPortDetectorContext";
import { warnOnce } from "../warnOnce";

// Constants
const DEFAULT_FREQUENCY = 1000;
const DEFAULT_PERCENT_WIDTH = 1;
const DEFAULT_PERCENT_HEIGHT = 1;
const INITIAL_CHECK_DELAY = 100;

type Timer = ReturnType<typeof setTimeout>;

type Props = {
  /**
   * The content to monitor.
   */
  children: React.ReactNode;

  /**
   * The frequency (in milliseconds) to check if the child is in the viewport.
   * Must be a positive number; falls back to the default otherwise.
   * @default 1000
   */
  frequency?: number;

  /**
   * The minimum percentage of width required for the child to be considered in the viewport.
   * Must be between 0 and 1.
   * @default 1
   */
  percentWidth?: number;

  /**
   * The minimum percentage of height required for the child to be considered in the viewport.
   * Must be between 0 and 1.
   * @default 1
   */
  percentHeight?: number;

  /**
   * Stop checking (and stop calling `onChange`) after the child is first reported visible.
   * @default false
   */
  runOnce?: boolean;

  /**
   * Set to false to pause checking, e.g. until data has loaded and the child has its final layout.
   * @default true
   */
  enabled?: boolean;

  /**
   * A callback function called when the visibility state changes.
   * @param isInViewPort - Whether the component is currently visible in the viewport
   * @returns void
   */
  onChange: (isInViewPort: boolean) => void;

  /**
   * Style for the wrapping view.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Optional test ID for testing purposes
   */
  testID?: string;

  /**
   * Optional accessibility label
   */
  accessibilityLabel?: string;
} & ViewStyle;

export const ViewPortDetector: React.FC<Props> = ({
  onChange,
  children,
  frequency = DEFAULT_FREQUENCY,
  percentWidth = DEFAULT_PERCENT_WIDTH,
  percentHeight = DEFAULT_PERCENT_HEIGHT,
  runOnce = false,
  enabled = true,
  style,
  testID,
  accessibilityLabel,
  ...styleProps
}) => {
  warnOnce(
    'v1-detector',
    'ViewPortDetector is deprecated and will be removed in v3. Use useInView() or <InView> — see docs/MIGRATION.md.'
  );
  const view = useRef<React.ComponentRef<typeof View>>(null);
  const { measureViewport } = useContext(ViewPortDetectorContext);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const windowLayout = useRef<LayoutRectangle>({
    x: 0,
    y: 0,
    width: screenWidth,
    height: screenHeight,
  });
  const onChangeRef = useRef(onChange);
  const lastValue = useRef<boolean | null>(null);
  const isDone = useRef(false);
  const isMounted = useRef(true);
  const intervalRef = useRef<Timer | undefined>(undefined);
  const layoutTimeoutRef = useRef<Timer | undefined>(undefined);
  const safeFrequency = frequency > 0 ? frequency : DEFAULT_FREQUENCY;

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    windowLayout.current = { x: 0, y: 0, width: screenWidth, height: screenHeight };
  }, [screenWidth, screenHeight]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Validate props
  useEffect(() => {
    if (frequency <= 0) {
      console.warn(
        `ViewPortDetector: frequency must be a positive number, falling back to ${DEFAULT_FREQUENCY}`
      );
    }
    if (percentWidth < 0 || percentWidth > 1) {
      console.warn("ViewPortDetector: percentWidth must be between 0 and 1");
    }
    if (percentHeight < 0 || percentHeight > 1) {
      console.warn("ViewPortDetector: percentHeight must be between 0 and 1");
    }
  }, [frequency, percentWidth, percentHeight]);

  const stopChecking = useCallback(() => {
    if (intervalRef.current !== undefined) {
      clearInterval(intervalRef.current);
    }
    if (layoutTimeoutRef.current !== undefined) {
      clearTimeout(layoutTimeoutRef.current);
    }
  }, []);

  // Only notify on transitions; with runOnce, stop for good after the first visible report.
  const report = useCallback(
    (isVisible: boolean) => {
      if (!isMounted.current || isDone.current || isVisible === lastValue.current) {
        return;
      }
      lastValue.current = isVisible;
      if (isVisible && runOnce) {
        isDone.current = true;
        stopChecking();
      }
      onChangeRef.current(isVisible);
    },
    [runOnce, stopChecking]
  );

  // Both rectangles come from measureInWindow so they share one coordinate space.
  const checkVisibility = useCallback(() => {
    if (!view.current || isDone.current) {
      return;
    }
    const measureChild = (viewport: LayoutRectangle) => {
      view.current?.measureInWindow((x, y, width, height) => {
        report(
          checkInViewPort(viewport, { x, y, width, height }, percentWidth, percentHeight)
        );
      });
    };

    try {
      if (measureViewport) {
        measureViewport(measureChild);
      } else {
        measureChild(windowLayout.current);
      }
    } catch (error: unknown) {
      console.error(
        "ViewPortDetector: Error measuring view:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }, [measureViewport, percentWidth, percentHeight, report]);

  // Re-check shortly after any layout change, coalescing bursts of onLayout events.
  const handleLayout = useCallback(() => {
    if (!enabled || isDone.current) {
      return;
    }
    if (layoutTimeoutRef.current !== undefined) {
      clearTimeout(layoutTimeoutRef.current);
    }
    layoutTimeoutRef.current = setTimeout(checkVisibility, INITIAL_CHECK_DELAY);
  }, [enabled, checkVisibility]);

  // Check viewport visibility periodically
  useEffect(() => {
    if (!enabled || isDone.current) {
      return;
    }
    const initialCheck = setTimeout(checkVisibility, INITIAL_CHECK_DELAY);
    intervalRef.current = setInterval(checkVisibility, safeFrequency);

    return () => {
      clearTimeout(initialCheck);
      stopChecking();
    };
  }, [enabled, safeFrequency, checkVisibility, stopChecking]);

  return (
    <View
      ref={view}
      onLayout={handleLayout}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      // Android flattens layout-only views, which makes measuring them return nothing.
      collapsable={false}
      style={[styleProps, style]}
    >
      {children}
    </View>
  );
};

ViewPortDetector.displayName = "ViewPortDetector";
