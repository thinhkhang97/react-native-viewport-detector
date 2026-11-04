import React, {useCallback, useContext, useMemo, useRef} from 'react';
import {StyleProp, View, ViewStyle} from 'react-native';
import {warnOnce} from '../warnOnce';
import {intersectRect} from './checkInViewPort';
import {MeasureViewport, ViewPortDetectorContext} from './ViewPortDetectorContext';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
} & ViewStyle;

export const ViewPortDetectorProvider: React.FC<Props> = ({
  children,
  style,
  testID,
  ...styleProps
}) => {
  warnOnce(
    'v1-provider',
    'ViewPortDetectorProvider is deprecated and will be removed in v3. Wrap your scroll view in <ViewportProvider> instead — see docs/MIGRATION.md.'
  );
  // ComponentRef works whether View is typed as a class (older RN) or a function with a ref prop (RN 0.80+ strict API).
  const view = useRef<React.ComponentRef<typeof View>>(null);

  const {measureViewport: measureParent} = useContext(ViewPortDetectorContext);

  // A nested provider is only as visible as its parent's viewport allows.
  const measureViewport = useCallback<MeasureViewport>(
    callback => {
      view.current?.measureInWindow((x, y, width, height) => {
        const own = {x, y, width, height};
        if (measureParent) {
          measureParent(parent => callback(intersectRect(own, parent)));
        } else {
          callback(own);
        }
      });
    },
    [measureParent],
  );

  const context = useMemo(() => ({measureViewport}), [measureViewport]);

  return (
    <ViewPortDetectorContext.Provider value={context}>
      <View
        ref={view}
        testID={testID}
        collapsable={false}
        style={[styleProps, style]}>
        {children}
      </View>
    </ViewPortDetectorContext.Provider>
  );
};
