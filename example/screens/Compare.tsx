import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BenchList, LIBRARIES, type LibraryId } from '../bench/adapters';
import { useBenchRun, type BenchResult } from '../bench/useBenchRun';

const COUNT = 300;

type Results = Partial<Record<LibraryId, BenchResult>>;

/** Runs the same scripted scroll against each library and prints comparable numbers. */
export function Compare() {
  const [library, setLibrary] = useState<LibraryId | null>(null);
  const [results, setResults] = useState<Results>({});
  const [status, setStatus] = useState('idle');
  const bench = useBenchRun(COUNT);

  const runAll = async () => {
    for (const { id } of LIBRARIES) {
      setStatus(`running ${id}`);
      bench.reset();
      setLibrary(id);
      const result = await bench.run();
      setResults(prev => ({ ...prev, [id]: result }));
    }
    setLibrary(null);
    setStatus('done');
  };

  return (
    <View style={styles.screen}>
      <View style={styles.panel}>
        <Pressable onPress={runAll} style={styles.button} testID="run-all">
          <Text style={styles.buttonText}>Run all ({COUNT} rows, 1500 px/s for 5 s)</Text>
        </Pressable>
        <Text style={styles.status} testID="status">
          {status}
        </Text>
        {LIBRARIES.map(({ id, label }) => {
          const r = results[id];
          return (
            <Text key={id} style={styles.result} testID={`result-${id}`}>
              {r
                ? `result|${id}|avg ${r.frameAvg}ms|p95 ${r.frameP95}ms|dropped ${r.droppedPct}%|stale ${r.stalePct}%|settledErrors ${r.settledErrors}|idle ${r.idleFrameAvg}ms|${r.debug}`
                : `${label}: –`}
            </Text>
          );
        })}
      </View>
      {library && (
        <BenchList
          key={library}
          library={library}
          count={COUNT}
          report={bench.report}
          scrollRef={bench.scrollRef}
          onLayout={bench.onLayout}
          onScroll={bench.onScroll}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  panel: { padding: 12, gap: 4, backgroundColor: '#1e293b' },
  button: { backgroundColor: '#6366f1', padding: 10, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
  status: { color: '#fbbf24', fontSize: 12 },
  result: { color: '#cbd5e1', fontSize: 11 },
});
