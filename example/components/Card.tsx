import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useInView, type UseInViewOptions } from 'react-native-viewport-detector';

type Props = UseInViewOptions & { label: string; small?: boolean; testID?: string };

/** A card that turns green while `useInView` reports it visible. */
export function Card({ label, small, testID, ...options }: Props) {
  const { ref, inView, entry } = useInView(options);
  return (
    <View ref={ref} testID={testID} style={[styles.card, small && styles.small, inView ? styles.in : styles.out]}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.state}>
        {inView ? 'in view' : 'out'}
        {entry && entry.intersectionRatio < 1 && inView ? ` · ${Math.round(entry.intersectionRatio * 100)}%` : ''}
      </Text>
    </View>
  );
}

export const cardStyles = StyleSheet.create({
  in: { backgroundColor: '#10b981' },
  out: { backgroundColor: '#334155' },
});

const styles = StyleSheet.create({
  card: { height: 150, marginBottom: 12, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  small: { width: 130, height: 100, marginBottom: 0 },
  in: cardStyles.in,
  out: cardStyles.out,
  label: { color: '#fff', fontSize: 22, fontWeight: '700' },
  state: { color: '#e2e8f0', fontSize: 13, marginTop: 4 },
});
