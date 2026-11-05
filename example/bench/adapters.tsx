import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { VisibilitySensor } from '@futurejj/react-native-visibility-sensor';
import { InView as IOInView, IOScrollView } from 'react-native-intersection-observer';
import { InView, useInView, ViewportProvider } from 'react-native-viewport-detector';
import { ViewPortDetector, ViewPortDetectorProvider } from 'rnvd-v1';

export const ROW_HEIGHT = 44;
export const ROW_GAP = 6;
export const LIST_PADDING = 12;

export type LibraryId = 'none' | 'v2' | 'v2-hook' | 'v1' | 'intersection-observer' | 'visibility-sensor';

export const LIBRARIES: Array<{ id: LibraryId; label: string }> = [
  { id: 'none', label: 'No tracking (control)' },
  { id: 'v2', label: 'react-native-viewport-detector 2.0 (<InView onChange>)' },
  { id: 'v2-hook', label: 'react-native-viewport-detector 2.0 (useInView, re-renders)' },
  { id: 'v1', label: 'react-native-viewport-detector 1.0.8' },
  { id: 'intersection-observer', label: 'react-native-intersection-observer 0.3' },
  { id: 'visibility-sensor', label: '@futurejj/react-native-visibility-sensor 1.4' },
];

/** Each row reports into this callback; nothing is rendered from it, so only library cost is measured. */
export type Report = (index: number, visible: boolean) => void;

interface ListProps {
  count: number;
  report: Report;
  scrollRef: React.RefObject<React.ComponentRef<typeof ScrollView> | null>;
  onLayout: (height: number) => void;
  onScroll: (y: number) => void;
}

const Label = ({ index }: { index: number }) => (
  <View style={styles.row}>
    <Text style={styles.text}>{index}</Text>
  </View>
);

const V2Row = memo(function V2Row({ index, report }: { index: number; report: Report }) {
  const { ref } = useInView({ onChange: visible => report(index, visible) });
  return (
    <View ref={ref} collapsable={false}>
      <Label index={index} />
    </View>
  );
});

function rows(count: number, render: (i: number) => React.ReactNode) {
  return Array.from({ length: count }, (_, i) => render(i));
}

/** Renders the same list with the selected library's recommended wiring. */
export function BenchList({ library, count, report, scrollRef, onLayout, onScroll }: ListProps & { library: LibraryId }) {
  const scrollProps = {
    ref: scrollRef as never,
    contentContainerStyle: styles.content,
    scrollEventThrottle: 16,
    onLayout: (e: { nativeEvent: { layout: { height: number } } }) => onLayout(e.nativeEvent.layout.height),
    onScroll: (e: { nativeEvent: { contentOffset: { y: number } } }) => onScroll(e.nativeEvent.contentOffset.y),
  };
  switch (library) {
    case 'v2':
      return (
        <ViewportProvider>
          <ScrollView {...scrollProps}>
            {rows(count, i => (
              <InView key={i} onChange={v => report(i, v)}>
                <Label index={i} />
              </InView>
            ))}
          </ScrollView>
        </ViewportProvider>
      );
    case 'v2-hook':
      return (
        <ViewportProvider>
          <ScrollView {...scrollProps}>{rows(count, i => <V2Row key={i} index={i} report={report} />)}</ScrollView>
        </ViewportProvider>
      );
    case 'v1':
      return (
        <ViewPortDetectorProvider flex={1}>
          <ScrollView {...scrollProps}>
            {rows(count, i => (
              <ViewPortDetector key={i} frequency={100} percentHeight={0.001} onChange={v => report(i, v)}>
                <Label index={i} />
              </ViewPortDetector>
            ))}
          </ScrollView>
        </ViewPortDetectorProvider>
      );
    case 'intersection-observer':
      return (
        <IOScrollView {...scrollProps}>
          {rows(count, i => (
            <IOInView key={i} onChange={(v: boolean) => report(i, v)}>
              <Label index={i} />
            </IOInView>
          ))}
        </IOScrollView>
      );
    case 'visibility-sensor':
      return (
        <ScrollView {...scrollProps}>
          {rows(count, i => (
            <VisibilitySensor key={i} onChange={v => report(i, v)}>
              <Label index={i} />
            </VisibilitySensor>
          ))}
        </ScrollView>
      );
    default:
      return <ScrollView {...scrollProps}>{rows(count, i => <Label key={i} index={i} />)}</ScrollView>;
  }
}

const styles = StyleSheet.create({
  content: { padding: LIST_PADDING },
  row: { height: ROW_HEIGHT, marginBottom: ROW_GAP, borderRadius: 8, justifyContent: 'center', paddingLeft: 12, backgroundColor: '#334155' },
  text: { color: '#fff' },
});
