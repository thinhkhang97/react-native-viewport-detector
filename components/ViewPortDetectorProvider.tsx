import React, {useState} from 'react';
import {
  LayoutChangeEvent,
  LayoutRectangle,
  View,
  ViewStyle,
} from 'react-native';
import {ViewPortDetectorContext} from './ViewPortDetectorContext';

type Props = {
  children: React.ReactElement;
} & ViewStyle;

export const ViewPortDetectorProvider: React.FC<Props> = ({
  children,
  ...props
}) => {
  const [context, setContext] = useState<{parentLayout?: LayoutRectangle}>({});
  const handleViewLayout = (event: LayoutChangeEvent) => {
    setContext({parentLayout: event.nativeEvent.layout});
  };
  return (
    <ViewPortDetectorContext.Provider value={context}>
      <View onLayout={handleViewLayout} {...props}>
        {children}
      </View>
    </ViewPortDetectorContext.Provider>
  );
};
