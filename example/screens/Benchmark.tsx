import React, { memo, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { InView, ViewportProvider } from 'react-native-viewport-detector';
import { __getAllStats } from '../../src/engine/stats';
import { cardStyles } from '../components/Card';

const COUNT = 1000;

const PlainRow = memo(function PlainRow({ index }: { index: number }) {
  return <View style={[styles.row, cardStyles.out]}><Text style={styles.label}>{index}</Text></View>;
});

const Row = memo(function Row({ index, paint }: { index: number; paint: boolean }) {
  return (
    <InView>
      {({ inView }) => (
        <View style={[styles.row, paint && inView ? cardStyles.in : cardStyles.out]}>
          <Text style={styles.label}>{index}</Text>
        </View>
      )}
    </InView>
  );
});

/** JS-thread frames per second (works in production builds, where the RN perf monitor is unavailable). */
function useJsFps() {
  const [fps, setFps] = useState(0);
  useEffect(() => {
    let frames = 0;
    let frame = requestAnimationFrame(function tick() {
      frames += 1;
      frame = requestAnimationFrame(tick);
    });
    const id = setInterval(() => {
      setFps(frames);
      frames = 0;
    }, 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, []);
  return fps;
}

/** 1,000 targets: idle passes must stay flat; scrolling must keep the JS frame time low. */
export function Benchmark() {
  const [tracked, setTracked] = useState(true);
  // Off = visibility is tracked but rows never change, isolating library cost from the app's own re-render cost.
  const [paint, setPaint] = useState(true);
  const jsFps = useJsFps();
  const [stats, setStats] = useState(__getAllStats());
  const [perSecond, setPerSecond] = useState({ passes: 0, notifications: 0, timeMs: 0 });

  useEffect(() => {
    let previous = __getAllStats();
    const id = setInterval(() => {
      const next = __getAllStats();
      setPerSecond({ passes: next.passes - previous.passes, notifications: next.notifications - previous.notifications, timeMs: next.timeMs - previous.timeMs });
      setStats(next);
      previous = next;
    }, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.toggle}>
        <Text style={styles.label}>Track visibility (off = control baseline)</Text>
        <Switch value={tracked} onValueChange={setTracked} />
      </View>
      <View style={styles.toggle}>
        <Text style={styles.label}>Paint rows on change</Text>
        <Switch value={paint} onValueChange={setPaint} />
      </View>
      <Text style={styles.stats}>
        JS {jsFps} fps · engine {perSecond.timeMs}ms/s · passes {stats.passes} (+{perSecond.passes}/s) · measurements {stats.measurements} · notifications{' '}
        {stats.notifications} (+{perSecond.notifications}/s)
      </Text>
      <ViewportProvider>
        <ScrollView contentContainerStyle={styles.content}>
          {Array.from({ length: COUNT }).map((_, i) =>
            tracked ? <Row key={i} index={i} paint={paint} /> : <PlainRow key={i} index={i} />
          )}
        </ScrollView>
      </ViewportProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  toggle: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 12, backgroundColor: '#1e293b' },
  stats: { color: '#fbbf24', fontSize: 12, padding: 12, backgroundColor: '#1e293b' },
  content: { padding: 12 },
  row: { height: 44, marginBottom: 6, borderRadius: 8, justifyContent: 'center', paddingLeft: 12 },
  label: { color: '#fff' },
});
