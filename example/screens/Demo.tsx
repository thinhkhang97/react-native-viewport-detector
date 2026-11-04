import React, { useEffect, useRef, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text } from 'react-native';
import { InView, ViewportProvider } from 'react-native-viewport-detector';
import { Card } from '../components/Card';
import { useAutoplay } from '../useAutoplay';

const VERTICAL_COUNT = 8;
const HORIZONTAL_COUNT = 8;
const NESTED_AFTER = 2;
// Flip to true to let a headless simulator (no touch injection) play the scripted demo, e.g. for GIFs.
const AUTOPLAY = false;

export function Demo() {
  const vertical = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const horizontal = useRef<React.ComponentRef<typeof ScrollView>>(null);
  useAutoplay(AUTOPLAY, vertical, horizontal);

  return (
    <ViewportProvider>
      <ScrollView ref={vertical} contentContainerStyle={styles.content}>
        {Array.from({ length: VERTICAL_COUNT }).map((_, i) => (
          <React.Fragment key={i}>
            <Card label={`V${i}`} threshold={1} />
            {i === NESTED_AFTER && (
              <ViewportProvider>
                <ScrollView ref={horizontal} horizontal style={styles.nested} contentContainerStyle={styles.row}>
                  {Array.from({ length: HORIZONTAL_COUNT }).map((__, j) => (
                    <Card key={j} label={`H${j}`} threshold={1} small />
                  ))}
                </ScrollView>
              </ViewportProvider>
            )}
          </React.Fragment>
        ))}
        <OnceCard />
      </ScrollView>
    </ViewportProvider>
  );
}

function OnceCard() {
  const [seen, setSeen] = useState(false);
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (seen) Animated.spring(progress, { toValue: 1, useNativeDriver: true }).start();
  }, [seen, progress]);

  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] });
  return (
    <InView triggerOnce threshold={0.6} onChange={setSeen}>
      <Animated.View style={[styles.once, { opacity: progress, transform: [{ scale }] }]}>
        <Text style={styles.onceLabel}>triggerOnce</Text>
        <Text style={styles.onceSub}>animated once</Text>
      </Animated.View>
    </InView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 12 },
  nested: { marginBottom: 12 },
  row: { gap: 12 },
  once: { height: 150, borderRadius: 14, justifyContent: 'center', alignItems: 'center', backgroundColor: '#6366f1' },
  onceLabel: { color: '#fff', fontSize: 22, fontWeight: '700' },
  onceSub: { color: '#e2e8f0', fontSize: 13, marginTop: 4 },
});
