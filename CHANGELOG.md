# Changelog

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
