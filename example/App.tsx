import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Benchmark } from './screens/Benchmark';
import { Compare } from './screens/Compare';
import { Demo } from './screens/Demo';
import { QA } from './screens/QA';
import { V1 } from './screens/V1';

const SCREENS = { Demo, QA, Benchmark, Compare, V1 } as const;
type ScreenName = keyof typeof SCREENS;

export default function App() {
  const [screen, setScreen] = useState<ScreenName>('Demo');
  const Screen = SCREENS[screen];
  return (
    <View style={styles.app}>
      <View style={styles.header}>
        <Text style={styles.title}>react-native-viewport-detector</Text>
        <View style={styles.tabs}>
          {(Object.keys(SCREENS) as ScreenName[]).map(name => (
            <Pressable key={name} onPress={() => setScreen(name)} style={[styles.tab, name === screen && styles.active]}>
              <Text style={styles.tabText}>{name}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Screen />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: '#0f172a' },
  header: { paddingTop: 52, paddingBottom: 10, paddingHorizontal: 12, backgroundColor: '#1e293b', gap: 8 },
  title: { color: '#f8fafc', fontSize: 16, fontWeight: '700' },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 999, backgroundColor: '#334155' },
  active: { backgroundColor: '#6366f1' },
  tabText: { color: '#fff', fontSize: 13 },
});
