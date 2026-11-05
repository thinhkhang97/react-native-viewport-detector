# Changelog

## Unreleased

### Fixed

- Type-checks against React Native 0.88 types (`unstable_batchedUpdates` now takes two arguments).

### Documentation

- Recycling lists (FlashList, Legend List): hook state belongs to the cell, so `triggerOnce` must not be used for once-per-item logic; recipe that dedupes by item id.
- Auto-play video recipe with `expo-video`, and when to prefer this library over `viewabilityConfig`.

### Development

- Library is developed and tested against React Native 0.88 / React 19.3 (Jest preset moved to `@react-native/jest-preset`).

## 2.0.0-beta.1

### Documentation

- README, CHANGELOG and migration guide now describe the shipped scroll engine (views near the viewport, median offset) instead of the earlier single-anchor design. No code changes.

## 2.0.0-beta.0

### Added

- `useInView`, `<InView>`, `<ViewportProvider>` and `useViewportRoot` with the web `react-intersection-observer` API shape: `threshold` (number or array, area-based), `rootMargin`, `triggerOnce`, `delay`, `skip`, `initialInView`, `onChange(inView, entry)`.
- Event-driven engine: no timers while idle; while scrolling, one batched check per frame that measures only the views near the viewport and takes the list's movement from their median, so a recycled cell or sticky header cannot shift the rest.
- Nested scroll views: each provider is clipped by its ancestors; `rootMargin` on the outer list carries into nested lists.
- Automatic pause while the app is in the background; native-driver `Animated.event` scroll fallback.
- `react-native-viewport-detector/jest` mock helpers.
- Compiled output with type definitions; `llms.txt`; example app with demo, QA, benchmark and library comparison screens.

### Changed

- Requires React 18+ and React Native 0.72+.

### Deprecated

- `ViewPortDetector` and `ViewPortDetectorProvider` (unchanged behaviour, one-time dev warning; removed in 3.0). See docs/MIGRATION.md.

### Removed

- Support for React 17 and React Native < 0.72 (stay on 1.x).

## 1.0.8

### Fixed

- TypeScript errors with React 19 and projects without Node types (`useRef` without an initial value, `NodeJS.Timeout`) (#10).
- Provider and detector were compared in different coordinate spaces (`onLayout` vs `measure`), giving wrong results under headers/safe-area insets and always `false` for providers nested inside another scroll view (#6, #8).
- Android view flattening made measurements empty; wrapping views now set `collapsable={false}` (#5, #8).
- `onChange` is now called only when visibility changes, and always uses the latest callback.
- A non-positive `frequency` no longer creates a busy loop; it falls back to the default.
- Bursts of `onLayout` events are coalesced into a single check (#3).
- Nested providers are clipped to their parent provider's viewport, so items in an off-screen horizontal list are no longer reported visible.
- View refs are typed with `React.ComponentRef<typeof View>`, which type-checks on RN 0.80+ where `View` is a function component.

### Added

- `runOnce` prop, restored after it was dropped in the #9 rewrite (#1).
- `enabled` prop to pause checking until the layout is final (#3).
- `style` prop on both components; style props passed directly are still supported.
- `peerDependencies`, a `files` whitelist, a LICENSE file and a Jest test suite.
