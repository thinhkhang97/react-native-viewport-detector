import { createJsEventEngine } from '../../engine/jsEventEngine';
import type { Engine } from '../../engine/types';
import { normalizeMargin } from '../../geometry';
import type { HostNode } from '../../measure';
import type { Rect, ViewportEntry } from '../../types';

const WINDOW: Rect = { x: 0, y: 0, width: 390, height: 844 };
const NO_MARGIN = normalizeMargin(0);
const OPTS = { thresholds: [0], targetMargin: NO_MARGIN };

type FakeNode = HostNode & { name: string };

let rects: Map<string, Rect>;
let asyncMode: boolean;
let engine: Engine;

const node = (name: string): FakeNode => ({ name });
const setRect = (name: string, rect: Rect) => {
  rects = new Map(rects).set(name, rect);
};
const measure = (n: HostNode) => {
  const rect = rects.get((n as FakeNode).name) ?? { x: 0, y: 0, width: 0, height: 0 };
  return asyncMode ? Promise.resolve(rect) : rect;
};
const frame = () => jest.advanceTimersByTime(16);
const flushAsync = async () => {
  frame();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  jest.useFakeTimers();
  rects = new Map();
  asyncMode = false;
  engine = createJsEventEngine({ measure, getWindowRect: () => WINDOW, now: () => 1 });
});

afterEach(() => {
  engine.dispose();
  jest.useRealTimers();
});

function observe(name: string, root: ReturnType<Engine['registerRoot']> | null, opts = OPTS) {
  const cb = jest.fn<void, [ViewportEntry]>();
  const n = node(name);
  const unobserve = engine.observe(() => n, root, opts, cb);
  return { cb, unobserve };
}

describe('JsEventEngine', () => {
  it('notifies on the first pass, then only on bucket changes', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb } = observe('a', root);
    frame();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0][0].isIntersecting).toBe(true);

    engine.invalidate('scroll', root);
    frame();
    expect(cb).toHaveBeenCalledTimes(1);
    expect(engine.getStats().passes).toBe(2);
  });

  it('coalesces invalidations into one pass per frame', () => {
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    observe('a', root);
    frame();
    engine.invalidate('scroll', root);
    engine.invalidate('scroll', root);
    engine.invalidate('layout', root);
    frame();
    expect(engine.getStats().passes).toBe(2);
  });

  it('does nothing while idle', () => {
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    observe('a', root);
    frame();
    const passes = engine.getStats().passes;
    jest.advanceTimersByTime(5000);
    expect(engine.getStats().passes).toBe(passes);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('clips nested roots by their ancestors', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('row', { x: 0, y: 1200, width: 390, height: 120 });
    setRect('item', { x: 0, y: 1200, width: 120, height: 120 });
    const outer = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const inner = engine.registerRoot(outer, () => node('row'), NO_MARGIN);
    const { cb } = observe('item', inner);
    frame();
    expect(cb.mock.calls[0][0].isIntersecting).toBe(false);

    setRect('row', { x: 0, y: 300, width: 390, height: 120 });
    setRect('item', { x: 0, y: 300, width: 120, height: 120 });
    engine.invalidate('scroll', outer);
    frame();
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: true }));
  });

  it('notifies once per threshold crossing', () => {
    setRect('list', { x: 0, y: 0, width: 100, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb } = observe('a', root, { thresholds: [0, 0.5], targetMargin: NO_MARGIN });
    const showRatio = (ratio: number) => {
      setRect('a', { x: 0, y: 100 - ratio * 100, width: 100, height: 100 });
      engine.invalidate('scroll', root);
      frame();
    };
    showRatio(0.3);
    showRatio(0.6);
    showRatio(0.7);
    expect(cb.mock.calls.map(([e]) => e.intersectionRatio)).toEqual([0.3, 0.6]);
  });

  it('zero-size target reports not intersecting', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 0, height: 0 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb } = observe('a', root);
    frame();
    expect(cb.mock.calls[0][0]).toMatchObject({ isIntersecting: false, intersectionRatio: 0 });
  });

  it('drops targets unobserved during an in-flight async pass', async () => {
    asyncMode = true;
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb, unobserve } = observe('a', root);
    frame();
    unobserve();
    await flushAsync();
    expect(cb).not.toHaveBeenCalled();
  });

  it('resolves async passes', async () => {
    asyncMode = true;
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb } = observe('a', root);
    await flushAsync();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ isIntersecting: true }));
  });

  it('reports everything out while paused and re-measures on resume', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb } = observe('a', root);
    frame();

    engine.setPaused(true);
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: false }));
    engine.invalidate('scroll', root);
    frame();
    expect(cb).toHaveBeenCalledTimes(2);

    engine.setPaused(false);
    frame();
    expect(cb).toHaveBeenCalledTimes(3);
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: true }));
  });

  it('measures only the invalidated root', () => {
    const a = engine.registerRoot(null, () => node('listA'), NO_MARGIN);
    const b = engine.registerRoot(null, () => node('listB'), NO_MARGIN);
    observe('a1', a);
    observe('b1', b);
    frame();
    const before = engine.getStats().measurements;
    engine.invalidate('scroll', a);
    frame();
    expect(engine.getStats().measurements - before).toBe(2); // listA + a1
  });

  it('uses the window as root for targets without one', () => {
    setRect('a', { x: 0, y: 900, width: 100, height: 100 });
    const { cb } = observe('a', null);
    frame();
    expect(cb.mock.calls[0][0]).toMatchObject({ isIntersecting: false, rootBounds: WINDOW });
  });
});

describe('JsEventEngine scroll passes', () => {
  function threeTargets() {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    setRect('b', { x: 0, y: 700, width: 390, height: 100 });
    setRect('c', { x: 0, y: 1100, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const targets = { a: observe('a', root), b: observe('b', root), c: observe('c', root) };
    frame();
    return { root, targets };
  }

  const scrollBy = (dy: number) => {
    ['a', 'b', 'c'].forEach(name => {
      const r = rects.get(name)!;
      setRect(name, { ...r, y: r.y - dy });
    });
  };

  it('measures the root and only the targets near the viewport', () => {
    const { root } = threeTargets();
    const before = engine.getStats().measurements;
    scrollBy(50);
    engine.invalidate('scroll', root);
    frame();
    expect(engine.getStats().measurements - before).toBe(3); // root + a + b; c is far below
  });

  it('moves un-measured targets by the anchor offset', () => {
    const { root, targets } = threeTargets();
    expect(targets.c.cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: false }));
    scrollBy(400);
    engine.invalidate('scroll', root);
    frame();
    expect(targets.c.cb).toHaveBeenLastCalledWith(
      expect.objectContaining({ isIntersecting: true, boundingClientRect: { x: 0, y: 700, width: 390, height: 100 } })
    );
  });

  it('re-measures every target on layout invalidations', () => {
    const { root } = threeTargets();
    const before = engine.getStats().measurements;
    engine.invalidate('layout', root);
    frame();
    expect(engine.getStats().measurements - before).toBe(4);
  });

  it('re-measures only targets near the viewport when scrolling settles', () => {
    const { root } = threeTargets();
    const before = engine.getStats().measurements;
    engine.invalidate('scroll-end', root);
    jest.advanceTimersByTime(200);
    expect(engine.getStats().measurements - before).toBe(3); // root + a (anchor) + b; c is far below
  });

  it('waits for scrolling to settle before the scroll-end re-measure', () => {
    const { root } = threeTargets();
    const before = engine.getStats().measurements;
    engine.invalidate('scroll-end', root);
    jest.advanceTimersByTime(100);
    expect(engine.getStats().measurements - before).toBe(0);
    engine.invalidate('scroll', root); // momentum keeps going
    frame();
    expect(engine.getStats().measurements - before).toBe(3);
    jest.advanceTimersByTime(120); // t = 236 < 100 + 150
    expect(engine.getStats().measurements - before).toBe(3);
    jest.advanceTimersByTime(20); // t = 256: settle timer fired
    expect(engine.getStats().measurements - before).toBe(6); // + root, a, b
    expect(jest.getTimerCount()).toBe(0);
  });

  it('measures a target added after the first pass on the next scroll pass', () => {
    const { root } = threeTargets();
    setRect('d', { x: 0, y: 300, width: 390, height: 100 });
    const d = observe('d', root);
    scrollBy(0);
    engine.invalidate('scroll', root);
    frame();
    expect(d.cb).toHaveBeenCalledWith(expect.objectContaining({ isIntersecting: true }));
  });
});

describe('JsEventEngine at scale', () => {
  function longList(count: number) {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const items = Array.from({ length: count }, (_, i) => {
      const name = `item${i}`;
      setRect(name, { x: 0, y: i * 100, width: 390, height: 100 });
      return observe(name, root);
    });
    frame();
    return { root, items };
  }

  const scrollList = (count: number, dy: number) => {
    for (let i = 0; i < count; i++) {
      const r = rects.get(`item${i}`)!;
      setRect(`item${i}`, { ...r, y: r.y - dy });
    }
  };

  it('evaluates only targets near the viewport during scroll passes', () => {
    const { root, items } = longList(200);
    const before = engine.getStats().evaluations;
    scrollList(200, 1000);
    engine.invalidate('scroll', root);
    frame();
    expect(engine.getStats().evaluations - before).toBeLessThan(60); // of 200
    expect(items[12].cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: true }));
    expect(items[3].cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: false }));
    expect(items[150].cb).toHaveBeenCalledTimes(1);
  });

  it('settles a long list without re-measuring every target', () => {
    const { root, items } = longList(200);
    const before = engine.getStats().measurements;
    scrollList(200, 1000);
    engine.invalidate('scroll-end', root);
    jest.advanceTimersByTime(200);
    expect(engine.getStats().measurements - before).toBeLessThan(60); // of 200
    expect(items[12].cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: true }));
  });

  it('measures a target mounted during scrolling on its own', () => {
    const { root } = longList(50);
    const before = engine.getStats().measurements;
    setRect('late', { x: 0, y: 200, width: 390, height: 100 });
    const late = observe('late', root);
    engine.invalidate('mount', root);
    frame();
    expect(engine.getStats().measurements - before).toBeLessThanOrEqual(12); // root + rows near the viewport + the new one, not all 51
    expect(late.cb).toHaveBeenCalledWith(expect.objectContaining({ isIntersecting: true }));
  });

  it('re-measures only the refreshed target', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    setRect('b', { x: 0, y: 300, width: 390, height: 100 });
    const cb = jest.fn();
    const handle = engine.observe(() => node('a'), root, OPTS, cb);
    observe('b', root);
    frame();
    const before = engine.getStats().measurements;
    setRect('a', { x: 0, y: 2000, width: 390, height: 100 });
    handle.refresh();
    frame();
    expect(engine.getStats().measurements - before).toBe(3); // root + anchor + a
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: false }));
  });
});

describe('JsEventEngine robustness (final review)', () => {
  function rowsOf(count: number, height = 100) {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const rows = Array.from({ length: count }, (_, i) => {
      setRect(`r${i}`, { x: 0, y: i * height, width: 390, height });
      return observe(`r${i}`, root);
    });
    frame();
    return { root, rows };
  }
  const visibleNow = (rows: Array<{ cb: jest.Mock }>) =>
    rows.map(r => r.cb.mock.calls[r.cb.mock.calls.length - 1]?.[0]?.isIntersecting);

  it('C1: a recycled cell that jumps away does not corrupt the other targets', () => {
    const { root, rows } = rowsOf(12);
    for (let i = 0; i < 12; i++) setRect(`r${i}`, { x: 0, y: i * 100 - 50, width: 390, height: 100 });
    setRect('r0', { x: 0, y: 1150, width: 390, height: 100 }); // recycled to the bottom
    engine.invalidate('scroll', root);
    frame();
    frame();
    expect(visibleNow(rows).slice(1, 9)).toEqual(Array(8).fill(true));
    expect(visibleNow(rows)[0]).toBe(false);
  });

  it('C1: a sticky header does not pin the other rows in view', () => {
    const { root, rows } = rowsOf(12);
    for (let i = 1; i < 12; i++) setRect(`r${i}`, { x: 0, y: i * 100 - 600, width: 390, height: 100 });
    // r0 stays at y=0 (sticky)
    engine.invalidate('scroll', root);
    frame();
    frame();
    expect(visibleNow(rows)[0]).toBe(true);
    expect(visibleNow(rows)[3]).toBe(false); // now at y = -300
    expect(visibleNow(rows)[7]).toBe(true); // now at y = 100
  });

  it('C2: a measurement that never answers does not stop the engine', async () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    const hanging = createJsEventEngine({
      getWindowRect: () => WINDOW,
      measure: n => ((n as FakeNode).name === 'ghost' ? new Promise<Rect>(() => {}) : Promise.resolve(rects.get((n as FakeNode).name)!)),
    });
    const root = hanging.registerRoot(null, () => node('list'), NO_MARGIN);
    const ghost = hanging.observe(() => node('ghost'), root, OPTS, jest.fn());
    jest.advanceTimersByTime(16); // pass starts measuring the ghost…
    ghost(); // …which unmounts before native answers
    const cb = jest.fn();
    hanging.observe(() => node('a'), root, OPTS, cb);
    for (let i = 0; i < 30; i++) {
      jest.advanceTimersByTime(16);
      await Promise.resolve();
      await Promise.resolve();
    }
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ isIntersecting: true }));
    hanging.dispose();
  });

  it('C3: targets observed before their root registers are adopted when it does', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    const handle = engine.allocateRoot(null);
    const cb = jest.fn();
    engine.observe(() => node('a'), handle, OPTS, cb);
    frame();
    engine.registerRoot(null, () => node('list'), NO_MARGIN, handle);
    frame();
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: true }));
    setRect('a', { x: 0, y: 2000, width: 390, height: 100 });
    engine.invalidate('scroll', handle);
    frame();
    frame();
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: false }));
  });

  it('C3: unregistering and re-registering a root keeps its targets', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('a', { x: 0, y: 2000, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    const { cb } = observe('a', root);
    frame();
    engine.unregisterRoot(root);
    engine.registerRoot(null, () => node('list'), NO_MARGIN, root);
    setRect('a', { x: 0, y: 100, width: 390, height: 100 });
    engine.invalidate('scroll', root);
    frame();
    frame();
    expect(cb).toHaveBeenLastCalledWith(expect.objectContaining({ isIntersecting: true }));
  });

  it('I2: a target whose node attaches later is measured on refresh', () => {
    setRect('list', { x: 0, y: 0, width: 390, height: 800 });
    setRect('late', { x: 0, y: 100, width: 390, height: 100 });
    const root = engine.registerRoot(null, () => node('list'), NO_MARGIN);
    let attached: HostNode | null = null;
    const cb = jest.fn();
    const observation = engine.observe(() => attached, root, OPTS, cb);
    frame();
    expect(cb).not.toHaveBeenCalled();
    attached = node('late');
    observation.refresh();
    frame();
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ isIntersecting: true }));
  });
});
