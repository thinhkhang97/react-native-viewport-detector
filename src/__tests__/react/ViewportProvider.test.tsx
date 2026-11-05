import React, { useContext } from 'react';
import { Animated, AppState, Dimensions, ScrollView, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { __resetDefaultEngine, __setEngineFactory } from '../../engine/defaultEngine';
import { createJsEventEngine } from '../../engine/jsEventEngine';
import type { Engine } from '../../engine/types';
import { ViewportContext } from '../../react/context';
import { ViewportProvider } from '../../react/ViewportProvider';
import { useViewportRoot } from '../../react/useViewportRoot';
import { __resetWarnings } from '../../warnOnce';

let engines: Engine[];
let appStateListener: ((state: string) => void) | undefined;
let dimensionsListener: (() => void) | undefined;

const latest = () => engines[engines.length - 1];

beforeEach(() => {
  jest.useFakeTimers();
  engines = [];
  __resetWarnings();
  __setEngineFactory(() => {
    const engine = createJsEventEngine({ measure: () => ({ x: 0, y: 0, width: 100, height: 100 }) });
    jest.spyOn(engine, 'invalidate');
    jest.spyOn(engine, 'setPaused');
    jest.spyOn(engine, 'registerRoot');
    engines.push(engine);
    return engine;
  });
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, cb: (s: string) => void) => {
    appStateListener = cb;
    return { remove: jest.fn() };
  }) as never);
  jest.spyOn(Dimensions, 'addEventListener').mockImplementation(((_type: string, cb: () => void) => {
    dimensionsListener = cb;
    return { remove: jest.fn() };
  }) as never);
});

afterEach(() => {
  __setEngineFactory(null);
  __resetDefaultEngine();
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const scrollEvent = { nativeEvent: { contentOffset: { x: 0, y: 10 } } };

describe('ViewportProvider', () => {
  it("calls the child's own onScroll and onLayout", () => {
    const onScroll = jest.fn();
    const onLayout = jest.fn();
    render(
      <ViewportProvider>
        <ScrollView testID="list" onScroll={onScroll} onLayout={onLayout} />
      </ViewportProvider>
    );
    fireEvent.scroll(screen.getByTestId('list'), scrollEvent);
    fireEvent(screen.getByTestId('list'), 'layout', { nativeEvent: { layout: {} } });
    expect(onScroll).toHaveBeenCalledTimes(1);
    expect(onLayout).toHaveBeenCalledTimes(1);
    expect(latest().invalidate).toHaveBeenCalledWith('scroll', expect.anything());
    expect(latest().invalidate).toHaveBeenCalledWith('layout', expect.anything());
  });

  it('runs a full re-measure when scrolling ends', () => {
    render(
      <ViewportProvider>
        <ScrollView testID="list" />
      </ViewportProvider>
    );
    fireEvent(screen.getByTestId('list'), 'momentumScrollEnd', scrollEvent);
    fireEvent(screen.getByTestId('list'), 'scrollEndDrag', scrollEvent);
    const reasons = (latest().invalidate as jest.Mock).mock.calls.map(([r]) => r);
    expect(reasons.filter(r => r === 'scroll-end')).toHaveLength(2);
  });

  it('keeps a child scrollEventThrottle and defaults to 16', () => {
    render(
      <ViewportProvider>
        <ScrollView testID="custom" scrollEventThrottle={64} />
      </ViewportProvider>
    );
    expect(screen.getByTestId('custom').props.scrollEventThrottle).toBe(64);
    render(
      <ViewportProvider>
        <ScrollView testID="default" />
      </ViewportProvider>
    );
    expect(screen.getByTestId('default').props.scrollEventThrottle).toBe(16);
  });

  it("still forwards the child's function and object refs", () => {
    const fnRef = jest.fn();
    const objRef = React.createRef<React.ComponentRef<typeof ScrollView>>();
    render(
      <View>
        <ViewportProvider>
          <ScrollView ref={fnRef} />
        </ViewportProvider>
        <ViewportProvider>
          <ScrollView ref={objRef} />
        </ViewportProvider>
      </View>
    );
    expect(fnRef).toHaveBeenCalledWith(expect.anything());
    expect(objRef.current).not.toBeNull();
  });

  it('warns once and stays functional with a native-driver Animated.event', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const scrollY = new Animated.Value(0);
    const nativeHandler = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
      useNativeDriver: true,
    });
    render(
      <ViewportProvider>
        <Animated.ScrollView testID="list" onScroll={nativeHandler} />
      </ViewportProvider>
    );
    expect(warn).toHaveBeenCalledTimes(1);
    const list = screen.getByTestId('list');
    const engine = latest();
    (engine.invalidate as jest.Mock).mockClear();

    fireEvent(list, 'scrollBeginDrag', scrollEvent);
    act(() => jest.advanceTimersByTime(48));
    expect((engine.invalidate as jest.Mock).mock.calls.filter(([r]) => r === 'scroll').length).toBeGreaterThanOrEqual(2);

    fireEvent(list, 'scrollEndDrag', scrollEvent);
    fireEvent(list, 'momentumScrollBegin', scrollEvent);
    fireEvent(list, 'momentumScrollEnd', scrollEvent);
    // I1: the library's own scroll-end handling must survive next to the fallback.
    expect((engine.invalidate as jest.Mock).mock.calls.filter(([r]) => r === 'scroll-end').length).toBe(2);
    act(() => jest.advanceTimersByTime(200));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('does not invalidate on plain re-renders', () => {
    const tree = (n: number) => (
      <ViewportProvider>
        <ScrollView testID={`list-${n}`} />
      </ViewportProvider>
    );
    const { rerender } = render(tree(1));
    (latest().invalidate as jest.Mock).mockClear();
    rerender(tree(2));
    rerender(tree(3));
    expect(latest().invalidate).not.toHaveBeenCalled();
  });

  it('re-measures on Dimensions change', () => {
    render(
      <ViewportProvider>
        <ScrollView />
      </ViewportProvider>
    );
    act(() => dimensionsListener?.());
    expect(latest().invalidate).toHaveBeenCalledWith('dimensions');
  });

  it('pauses while the app is in the background', () => {
    render(
      <ViewportProvider>
        <ScrollView />
      </ViewportProvider>
    );
    act(() => appStateListener?.('background'));
    expect(latest().setPaused).toHaveBeenLastCalledWith(true);
    act(() => appStateListener?.('active'));
    expect(latest().setPaused).toHaveBeenLastCalledWith(false);
  });

  it('ignores app state when pauseWhenInactive is false', () => {
    appStateListener = undefined;
    render(
      <ViewportProvider pauseWhenInactive={false}>
        <ScrollView />
      </ViewportProvider>
    );
    act(() => appStateListener?.('background'));
    expect(latest().setPaused).not.toHaveBeenCalled();
  });

  it('registers a nested provider under its parent root and reuses the engine', () => {
    render(
      <ViewportProvider>
        <ScrollView>
          <ViewportProvider>
            <ScrollView horizontal />
          </ViewportProvider>
        </ScrollView>
      </ViewportProvider>
    );
    expect(engines).toHaveLength(1);
    // Effects run child-first, so the nested root may register before its parent; only the link matters.
    const calls = (latest().registerRoot as jest.Mock).mock.calls;
    const outer = calls.find(([parent]) => parent === null)![3];
    const nested = calls.find(([parent]) => parent !== null)!;
    expect(nested[0]).toBe(outer);
  });
});

describe('useViewportRoot', () => {
  function RootProbe() {
    const ctx = useContext(ViewportContext);
    return <Text testID="probe">{String(ctx?.root?.id)}</Text>;
  }

  function List() {
    const root = useViewportRoot();
    return (
      <ScrollView ref={root.ref} {...root.scrollProps}>
        <root.Provider>
          <RootProbe />
        </root.Provider>
        <Text testID="own">{String(root.handle.id)}</Text>
      </ScrollView>
    );
  }

  it('gives descendants of Provider the same root as ref', () => {
    render(<List />);
    expect(screen.getByTestId('probe').props.children).toBe(screen.getByTestId('own').props.children);
  });
});
