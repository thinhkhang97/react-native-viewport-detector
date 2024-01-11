import React, { useContext, useEffect, useRef } from "react";
import { Dimensions, View, ViewStyle } from "react-native";
import { LayoutRectangle } from "../types";
import { checkInViewPort } from "../utils";
import { ViewPortDetectorContext } from "./ViewPortDetectorContext";

type Props = {
  /**
   * The child component to monitor.
   */
  children: React.ReactElement;

  /**
   * The frequency (in milliseconds) to check if the child is in the viewport.
   */
  frequency?: number;

  /**
   * The minimum percentage of width required for the child to be considered in the viewport.
   */
  percentWidth?: number;

  /**
   * The minimum percentage of height required for the child to be considered in the viewport.
   */
  percentHeight?: number;

  /**
   * If true, the child will be measured immediately after the component is mounted.
   */
  startMeasuring?: boolean;

  /**
   * A callback function called when the visibility state changes.
   * @param isInViewPort
   * @returns void
   */
  onChange: (isInViewPort: boolean) => void;
} & ViewStyle;

const SCREEN_WIDTH = Dimensions.get("window").width;
const SCREEN_HEIGHT = Dimensions.get("window").height;

export const ViewPortDetector: React.FC<Props> = ({
  onChange,
  children,
  frequency = 1000,
  percentWidth = 1,
  percentHeight = 1,
  startMeasuring = true,
  ...props
}) => {
  const view = useRef<View>(null);
  const { parentLayout } = useContext(ViewPortDetectorContext);
  const parentLayoutRef = useRef<LayoutRectangle>({
    x: 0,
    y: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });

  useEffect(() => {
    if (
      parentLayout &&
      parentLayout.height > 0 &&
      parentLayout.width > 0 &&
      parentLayoutRef.current
    ) {
      parentLayoutRef.current.height = parentLayout.height;
      parentLayoutRef.current.width = parentLayout.width;
      parentLayoutRef.current.x = parentLayout.x;
      parentLayoutRef.current.y = parentLayout.y;
    }
  }, [parentLayout]);

  /**
   * Use an interval to periodically check if the child view is in the viewport.
   */
  useEffect(() => {
    if (!view.current || !parentLayoutRef.current || !startMeasuring) {
      return;
    }
    view.current.measure(
      (
        _: number,
        __: number,
        width: number,
        height: number,
        pageX: number,
        pageY: number
      ) => {
        onChange(
          checkInViewPort(
            parentLayoutRef.current,
            {
              x: pageX,
              y: pageY,
              width,
              height,
            },
            percentWidth,
            percentHeight
          )
        );
      }
    );
  }, [startMeasuring]);

  return (
    <View ref={view} {...props}>
      {children}
    </View>
  );
};
