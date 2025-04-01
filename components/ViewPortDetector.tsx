import React, {
  useContext,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { View, ViewStyle, useWindowDimensions } from "react-native";
import { LayoutRectangle } from "../types";
import { checkInViewPort } from "../utils";
import { ViewPortDetectorContext } from "./ViewPortDetectorContext";

// Constants
const DEFAULT_FREQUENCY = 1000;
const DEFAULT_PERCENT_WIDTH = 1;
const DEFAULT_PERCENT_HEIGHT = 1;
const INITIAL_CHECK_DELAY = 100;

type Props = {
  /**
   * The child component to monitor.
   */
  children: React.ReactElement;

  /**
   * The frequency (in milliseconds) to check if the child is in the viewport.
   * Must be a positive number.
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
   * A callback function called when the visibility state changes.
   * @param isInViewPort - Whether the component is currently visible in the viewport
   * @returns void
   */
  onChange: (isInViewPort: boolean) => void;

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
  testID,
  accessibilityLabel,
  ...props
}) => {
  const view = useRef<View>(null);
  const { parentLayout } = useContext(ViewPortDetectorContext);
  const isFirstLayout = useRef(true);
  const timeoutRef = useRef<NodeJS.Timeout>();
  const intervalRef = useRef<NodeJS.Timeout>();
  const isMounted = useRef(true);
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  // Memoize initial parent layout
  const initialParentLayout = useMemo<LayoutRectangle>(
    () => ({
      x: 0,
      y: 0,
      width: screenWidth,
      height: screenHeight,
    }),
    [screenWidth, screenHeight]
  );

  const parentLayoutRef = useRef<LayoutRectangle>(initialParentLayout);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMounted.current = false;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Validate props
  useEffect(() => {
    if (frequency <= 0) {
      console.warn("ViewPortDetector: frequency must be a positive number");
    }
    if (percentWidth < 0 || percentWidth > 1) {
      console.warn("ViewPortDetector: percentWidth must be between 0 and 1");
    }
    if (percentHeight < 0 || percentHeight > 1) {
      console.warn("ViewPortDetector: percentHeight must be between 0 and 1");
    }
  }, [frequency, percentWidth, percentHeight]);

  // Update parent layout reference when it changes
  useEffect(() => {
    if (parentLayout) {
      parentLayoutRef.current = parentLayout;
    }
  }, [parentLayout]);

  const checkVisibility = useCallback(() => {
    if (!view.current || !parentLayoutRef.current || !isMounted.current) {
      return;
    }

    try {
      view.current.measure(
        (
          x: number,
          y: number,
          width: number,
          height: number,
          pageX: number,
          pageY: number
        ) => {
          // Skip if we don't have valid measurements
          if (
            width === undefined ||
            height === undefined ||
            pageX === undefined ||
            pageY === undefined
          ) {
            console.warn("ViewPortDetector: Invalid measurements received");
            return;
          }

          const isVisible = checkInViewPort(
            parentLayoutRef.current,
            {
              x: pageX,
              y: pageY,
              width,
              height,
            },
            percentWidth,
            percentHeight
          );

          if (isMounted.current) {
            onChange(isVisible);
          }
        }
      );
    } catch (error: unknown) {
      console.error(
        "ViewPortDetector: Error measuring view:",
        error instanceof Error ? error.message : String(error)
      );
    }
  }, [onChange, percentWidth, percentHeight]);

  // Handle layout changes
  const handleLayout = useCallback(() => {
    if (isFirstLayout.current) {
      isFirstLayout.current = false;
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Small delay to ensure layout is complete
      timeoutRef.current = setTimeout(checkVisibility, INITIAL_CHECK_DELAY);
    }
  }, [checkVisibility]);

  // Check viewport visibility periodically
  useEffect(() => {
    // Initial check after a small delay to ensure layout is complete
    const initialCheck = setTimeout(checkVisibility, INITIAL_CHECK_DELAY);

    // Set up interval for periodic checks
    intervalRef.current = setInterval(checkVisibility, frequency);

    return () => {
      clearTimeout(initialCheck);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [frequency, checkVisibility]);

  return (
    <View
      ref={view}
      onLayout={handleLayout}
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      {...props}
    >
      {children}
    </View>
  );
};

ViewPortDetector.displayName = "ViewPortDetector";
