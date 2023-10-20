# React Native Viewport Detector

![example](https://github.com/thinhkhang97/react-native-viewport-detector/blob/7ca62c6e0c7ed03e70987e2eb4f7b50b13f95608/examples/example-2.gif)

`react-native-viewport-detector` is a library for monitoring the visibility of React Native components within the viewport. It provides a straightforward way to track whether a child component is currently visible to the user on the screen, based on a given percentage of its width and height within the viewport.

## Features

- Determine if a React Native component is in the viewport based on a specified percentage of its dimensions.
- Simple and easy-to-use API for tracking component visibility.
- Suitable for various use cases, such as lazy loading, animations, or tracking user interactions.

## Installation

To use `react-native-viewport-detector` in your React Native project, you need to install it via npm or yarn:

```bash
npm install react-native-viewport-detector
# or
yarn add react-native-viewport-detector
```

## Usage

The `ViewPortDetectorProvider` component should be the first nested component and wrap a scrollable view in your screen to detect exactly the viewport position when user scrolls. If you don't wrap your scrollview with the provider, the component will use the default viewport which is {x: 0, y: 0, width: SCREEN_WIDTH, height: SCREEN_HEIGHT}

```tsx
import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, View } from "react-native";
import {
  ViewPortDetector,
  ViewPortDetectorProvider,
} from "react-native-viewport-detector";

function App(): JSX.Element {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header} />
      <ViewPortDetectorProvider flex={1}>
        <ScrollView>
          {Array.from({ length: 10 }).map((_, index) => (
            <ViewComponent key={`app_item_${index}`} />
          ))}
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
```

## API

| Properties      |                                       Description                                        | Default |
| --------------- | :--------------------------------------------------------------------------------------: | :-----: |
| `frequency`     |         The frequency (in milliseconds) to check if the child is in the viewport         |  1000   |
| `percentWidth`  | The minimum percentage of width required for the child to be considered in the viewport  |    1    |
| `percentHeight` | The minimum percentage of height required for the child to be considered in the viewport |    1    |

| API        |                         Description                          | Required |
| ---------- | :----------------------------------------------------------: | :------: |
| `onChange` | A callback function called when the visibility state changes |   true   |

## License

ISC
