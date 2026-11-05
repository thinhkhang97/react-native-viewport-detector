# Migrating from 1.x to 2.0

Nothing breaks on upgrade: `ViewPortDetector` and `ViewPortDetectorProvider` behave exactly as in 1.0.8 (including their polling interval) and only log a one-time deprecation warning in development. They will be removed in 3.0.

2.0 requires **React 18+ and React Native 0.72+**. Apps on older versions should stay on 1.x (`npm install react-native-viewport-detector@^1`).

## Why move

The 1.x components poll: every detector runs its own timer and asks native for its position, even when nothing moves. 2.0 updates only when the list scrolls or lays out, measures one anchor view per list per frame, and uses the same API as the web's `react-intersection-observer`.

## Mapping

| 1.x | 2.0 |
| --- | --- |
| `<ViewPortDetectorProvider>` around a `View` that contains the scroll view | `<ViewportProvider>` wrapping **the scroll view itself** (exactly one child) |
| `<ViewPortDetector onChange={fn}>child</ViewPortDetector>` | `<InView onChange={fn}>child</InView>` or `const { ref, inView } = useInView()` |
| `percentHeight={0.7}` (per axis) | `threshold={0.7}` — **area-based**: 70% of the view's area. For a full-width row this is the same as 70% of its height. |
| `percentWidth` | Area-based `threshold` covers both axes. |
| `runOnce` | `triggerOnce` |
| `enabled={false}` | `skip` (inverted) |
| `frequency` | Removed — updates follow scroll and layout events. |
| `onChange(isInViewPort)` | `onChange(inView, entry)` — `entry.intersectionRatio` gives the exact share. |

## Before / after

```tsx
// 1.x
<ViewPortDetectorProvider flex={1}>
  <ScrollView>
    <ViewPortDetector onChange={setVisible} percentHeight={0.7} frequency={300}>
      <Card />
    </ViewPortDetector>
  </ScrollView>
</ViewPortDetectorProvider>

// 2.0
<ViewportProvider>
  <ScrollView>
    <InView onChange={setVisible} threshold={0.7}>
      <Card />
    </InView>
  </ScrollView>
</ViewportProvider>
```

## Gotchas

- A `useInView` without a `<ViewportProvider>` above it measures against the window and is **not** updated while scrolling; it warns once in development. Pass `root={null}` on intentionally static screens.
- Mixing is fine during migration: a 1.x detector inside a 2.0 provider keeps polling on its own.
