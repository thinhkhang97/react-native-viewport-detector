import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import { ViewPortDetectorProvider, ViewPortDetector } from "./components";

function App(): JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header} />
      <ViewPortDetectorProvider flex={1}>
        <ScrollView>
          {Array.from({ length: 10 }).map((_, index) => (
            <ViewComponent key={`app_item_${index}`} />
          ))}
          <ViewPortDetectorProvider marginVertical={12}>
            <ScrollView horizontal>
              {Array.from({ length: 10 }).map((_, index) => (
                <HorizontalComponent key={`app_item_${index}`} />
              ))}
            </ScrollView>
          </ViewPortDetectorProvider>
        </ScrollView>
      </ViewPortDetectorProvider>
    </SafeAreaView>
  );
}

function ViewComponent(): JSX.Element {
  const [inViewPort, setInViewPort] = useState(false);
  return (
    <ViewPortDetector
      onChange={setInViewPort}
      percentHeight={0.7}
      frequency={300}
    >
      <View style={[styles.item, inViewPort ? styles.inViewPort : undefined]} />
    </ViewPortDetector>
  );
}

function HorizontalComponent(): JSX.Element {
  const [inViewPort, setInViewPort] = useState(false);
  return (
    <ViewPortDetector
      onChange={setInViewPort}
      percentWidth={0.7}
      frequency={300}
    >
      <View
        style={[
          styles.horizontalItem,
          inViewPort ? styles.inViewPort : undefined,
        ]}
      />
    </ViewPortDetector>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    width: "100%",
    height: 100,
    backgroundColor: "blue",
  },
  item: {
    marginBottom: 24,
    width: "100%",
    height: 250,
    backgroundColor: "yellow",
  },
  horizontalItem: {
    marginHorizontal: 8,
    width: 200,
    height: 150,
    backgroundColor: "green",
  },
  inViewPort: {
    borderWidth: 12,
    borderColor: "red",
  },
});

export default App;
