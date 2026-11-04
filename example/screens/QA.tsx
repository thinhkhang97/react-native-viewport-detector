import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, Text, useWindowDimensions, View } from 'react-native';
import { unstable_setMeasureMode, ViewportProvider } from 'react-native-viewport-detector';
import { Card } from '../components/Card';

/** Manual QA checklist screen; each card says what it should do. */
export function QA() {
  const [asyncMode, setAsyncMode] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const { width, height } = useWindowDimensions();

  const toggleMode = (next: boolean) => {
    unstable_setMeasureMode(next ? 'async' : 'auto');
    setAsyncMode(next);
  };
  const log = (label: string) => (inView: boolean) =>
    setEvents(prev => [`${label} ${inView ? 'in' : 'out'}`, ...prev].slice(0, 4));

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <View style={styles.row}>
          <Text style={styles.text}>Force async measure (RN &lt; 0.82 path)</Text>
          <Switch value={asyncMode} onValueChange={toggleMode} />
        </View>
        <Text style={styles.text}>
          Window {Math.round(width)}×{Math.round(height)} · rotate: cards must re-evaluate
        </Text>
        <Text style={styles.text}>Events (background the app → Q0 must log "out"): {events.join(' · ') || '–'}</Text>
      </View>
      <ViewportProvider rootMargin={{ bottom: 0 }}>
        <ScrollView contentContainerStyle={styles.content}>
          <Card label="Q0 · fully visible = in" threshold={1} onChange={log('Q0')} />
          <Card label="Q1 · delay 500ms" delay={500} threshold={1} />
          <Card label="Q2 · triggerOnce" triggerOnce threshold={1} />
          <ViewportProvider>
            <ScrollView horizontal contentContainerStyle={styles.carousel}>
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} label={`C${i}`} small threshold={1} />
              ))}
            </ScrollView>
          </ViewportProvider>
          <Card label="Q3 · 50% threshold" threshold={0.5} />
          <Card label="Q4 · preload 200px" rootMargin={{ bottom: 200 }} />
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} label={`F${i}`} threshold={1} />
          ))}
        </ScrollView>
      </ViewportProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  panel: { padding: 12, gap: 6, backgroundColor: '#1e293b' },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  text: { color: '#cbd5e1', fontSize: 12 },
  content: { padding: 12 },
  carousel: { gap: 12, marginBottom: 12 },
});
