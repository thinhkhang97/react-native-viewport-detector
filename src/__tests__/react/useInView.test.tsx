import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { __resetDefaultEngine, __setEngineFactory } from '../../engine/defaultEngine';
import { createJsEventEngine } from '../../engine/jsEventEngine';
import type { Engine } from '../../engine/types';
import type { HostNode } from '../../measure';
import { InView } from '../../react/InView';
import { useInView, type UseInViewOptions } from '../../react/useInView';
import { ViewportProvider } from '../../react/ViewportProvider';
import type { Rect } from '../../types';
import { __resetWarnings } from '../../warnOnce';

const LIST: Rect = { x: 0, y: 0, width: 400, height: 800 };
const VISIBLE: Rect = { x: 0, y: 100, width: 400, height: 100 };
const HIDDEN: Rect = { x: 0, y: 2000, width: 400, height: 100 };
const HALF: Rect = { x: 0, y: 750, width: 400, height: 100 };

let rects: Record<string, Rect>;
let asyncMeasure: boolean;
let engine: Engine;
let unobserves: jest.Mock[];

const testIdOf = (n: HostNode) => (n as unknown as { props?: { testID?: string } }).props?.testID ?? '';

beforeEach(() => {
  jest.useFakeTimers();
  __resetWarnings();
  rects = { list: LIST, target: HIDDEN };
  asyncMeasure = false;
  unobserves = [];
  __setEngineFactory(() => {
    engine = createJsEventEngine({
      getWindowRect: () => ({ x: 0, y: 0, width: 400, height: 844 }),
      measure: n => {
        const rect = rects[testIdOf(n)] ?? { x: 0, y: 0, width: 0, height: 0 };
        return asyncMeasure ? Promise.resolve(rect) : rect;
      },
    });
    const realObserve = engine.observe;
    engine.observe = jest.fn((...args: Parameters<Engine['observe']>) => {
      const observation = realObserve(...args);
      const unobserve = Object.assign(jest.fn(observation), { refresh: observation.refresh });
      unobserves.push(unobserve);
      return unobserve;
    });
    return engine;
  });
});

afterEach(() => {
  __setEngineFactory(null);
  __resetDefaultEngine();
  jest.useRealTimers();
});

let renders = 0;

function Target(props: UseInViewOptions & { root?: null }) {
  renders += 1;
  const { ref, inView } = useInView(props);
  return (
    <View ref={ref} testID="target">
      <Text testID="state">{String(inView)}</Text>
    </View>
  );
}

const inList = (child: React.ReactNode) => (
  <ViewportProvider>
    <ScrollView testID="list">{child}</ScrollView>
  </ViewportProvider>
);

const frame = () => act(() => jest.advanceTimersByTime(16));
const scrollTo = (rect: Rect) => {
  rects = { ...rects, target: rect };
  fireEvent.scroll(screen.getByTestId('list'), { nativeEvent: { contentOffset: { x: 0, y: 1 } } });
  frame();
};
const state = () => screen.getByTestId('state').props.children;

describe('useInView', () => {
  it('flips inView when the target scrolls into view', () => {
    const onChange = jest.fn();
    render(inList(<Target onChange={onChange} />));
    frame();
    expect(state()).toBe('false');
    scrollTo(VISIBLE);
    expect(state()).toBe('true');
    expect(onChange).toHaveBeenLastCalledWith(true, expect.objectContaining({ isIntersecting: true }));
    expect(onChange.mock.calls.filter(([v]) => v === true)).toHaveLength(1);
  });

  it('supports the array form', () => {
    function ArrayTarget() {
      const [ref, inView] = useInView();
      return (
        <View ref={ref} testID="target">
          <Text testID="state">{String(inView)}</Text>
        </View>
      );
    }
    rects.target = VISIBLE;
    render(inList(<ArrayTarget />));
    frame();
    expect(state()).toBe('true');
  });

  it('reports every threshold crossing while staying in view', () => {
    const onChange = jest.fn();
    render(inList(<Target threshold={[0, 1]} onChange={onChange} />));
    frame();
    scrollTo(HALF);
    scrollTo(VISIBLE);
    const visibleCalls = onChange.mock.calls.filter(([v]) => v === true);
    expect(visibleCalls.map(([, e]) => e.intersectionRatio)).toEqual([0.5, 1]);
    expect(state()).toBe('true');
  });

  it('waits for delay before reporting visible', () => {
    render(inList(<Target delay={300} />));
    frame();
    scrollTo(VISIBLE);
    act(() => jest.advanceTimersByTime(283));
    expect(state()).toBe('false');
    act(() => jest.advanceTimersByTime(17));
    expect(state()).toBe('true');
  });

  it('cancels a pending delay when the target leaves', () => {
    const onChange = jest.fn();
    render(inList(<Target delay={300} onChange={onChange} />));
    frame();
    scrollTo(VISIBLE);
    act(() => jest.advanceTimersByTime(200));
    scrollTo(HIDDEN);
    act(() => jest.advanceTimersByTime(500));
    expect(state()).toBe('false');
    expect(onChange).not.toHaveBeenCalledWith(true, expect.anything());
  });

  it('stops observing after the first visible report with triggerOnce', () => {
    render(inList(<Target triggerOnce />));
    frame();
    scrollTo(VISIBLE);
    expect(unobserves[unobserves.length - 1]).toHaveBeenCalled();
    scrollTo(HIDDEN);
    expect(state()).toBe('true');
  });

  it('does not observe while skip is true', () => {
    const onChange = jest.fn();
    rects.target = VISIBLE;
    const { rerender } = render(inList(<Target skip onChange={onChange} />));
    frame();
    expect(onChange).not.toHaveBeenCalled();
    rerender(inList(<Target skip={false} onChange={onChange} />));
    frame();
    expect(onChange).toHaveBeenCalledWith(true, expect.anything());
  });

  it('does not call onChange after unmount', async () => {
    const onChange = jest.fn();
    rects.target = VISIBLE;
    const { unmount } = render(inList(<Target delay={300} onChange={onChange} />));
    frame();
    asyncMeasure = true;
    scrollTo(HIDDEN);
    unmount();
    act(() => jest.advanceTimersByTime(1000));
    await act(async () => {
      await Promise.resolve();
    });
    expect(onChange.mock.calls.filter(([v]) => v === true)).toHaveLength(0);
  });

  it('inline option objects do not re-observe', () => {
    const { rerender } = render(inList(<Target threshold={[0, 0.5]} rootMargin={{ bottom: 100 }} />));
    frame();
    const observed = (engine.observe as jest.Mock).mock.calls.length;
    const before = renders;
    rerender(inList(<Target threshold={[0, 0.5]} rootMargin={{ bottom: 100 }} />));
    rerender(inList(<Target threshold={[0, 0.5]} rootMargin={{ bottom: 100 }} />));
    frame();
    expect((engine.observe as jest.Mock).mock.calls.length).toBe(observed);
    expect(renders - before).toBe(2); // only the two explicit rerenders
  });

  it('warns once when there is no provider, unless root is null', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Target />);
    render(<Target />);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockClear();
    __resetWarnings();
    render(<Target root={null} />);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('InView', () => {
  it('renders a non-collapsable view and passes state to render children', () => {
    rects.target = VISIBLE;
    render(
      inList(
        <InView testID="target">
          {({ inView }) => <Text testID="state">{String(inView)}</Text>}
        </InView>
      )
    );
    frame();
    expect(state()).toBe('true');
    expect(screen.getByTestId('target').props.collapsable).toBe(false);
  });
});

describe('InView render cost', () => {
  it('does not re-render when children are plain nodes (state is never read)', () => {
    const onRender = jest.fn();
    const onChange = jest.fn();
    render(
      inList(
        <React.Profiler id="inview" onRender={onRender}>
          <InView testID="target" onChange={onChange}>
            <Text>static</Text>
          </InView>
        </React.Profiler>
      )
    );
    frame();
    const commits = onRender.mock.calls.length;
    scrollTo(VISIBLE);
    expect(onChange).toHaveBeenLastCalledWith(true, expect.anything());
    expect(onRender.mock.calls.length).toBe(commits);
  });

  it('still re-renders render-function children', () => {
    rects.target = HIDDEN;
    render(
      inList(
        <InView testID="target">{({ inView }) => <Text testID="state">{String(inView)}</Text>}</InView>
      )
    );
    frame();
    scrollTo(VISIBLE);
    expect(state()).toBe('true');
  });
});

describe('root lifecycle (final review C3 / I2)', () => {
  it('C3: works under React StrictMode', () => {
    render(<React.StrictMode>{inList(<Target />)}</React.StrictMode>);
    frame();
    scrollTo(VISIBLE);
    frame();
    expect(state()).toBe('true');
  });

  it('C3: keeps tracking after the provider rootMargin changes', () => {
    const tree = (margin: number) => (
      <ViewportProvider rootMargin={margin}>
        <ScrollView testID="list">
          <Target />
        </ScrollView>
      </ViewportProvider>
    );
    const { rerender } = render(tree(0));
    frame();
    rerender(tree(10));
    frame();
    scrollTo(VISIBLE);
    frame();
    expect(state()).toBe('true');
  });

  it('C3: keeps tracking after pauseWhenInactive changes', () => {
    const tree = (pause: boolean) => (
      <ViewportProvider pauseWhenInactive={pause}>
        <ScrollView testID="list">
          <Target />
        </ScrollView>
      </ViewportProvider>
    );
    const { rerender } = render(tree(true));
    frame();
    rerender(tree(false));
    frame();
    scrollTo(VISIBLE);
    frame();
    expect(state()).toBe('true');
  });

  it('I2: measures a view whose ref attaches after the first pass', () => {
    rects.target = VISIBLE;
    rects.other = { x: 0, y: 300, width: 400, height: 100 };
    function Late({ show }: { show: boolean }) {
      const { ref, inView } = useInView();
      return (
        <View>
          <InView testID="other" />
          {show && <View ref={ref} testID="target" />}
          <Text testID="state">{String(inView)}</Text>
        </View>
      );
    }
    const { rerender } = render(inList(<Late show={false} />));
    frame();
    rerender(inList(<Late show />));
    frame();
    frame();
    expect(state()).toBe('true');
  });
});
