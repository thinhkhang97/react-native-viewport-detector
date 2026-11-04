import { Dimensions } from 'react-native';
import { createJsEventEngine } from '../../engine/jsEventEngine';
import { normalizeMargin } from '../../geometry';
import type { ViewportEntry } from '../../types';

describe('default window rectangle', () => {
  it('uses the full screen so edge-to-edge Android content above the nav bar counts as visible', () => {
    jest.useFakeTimers();
    jest.spyOn(Dimensions, 'get').mockImplementation(dim =>
      dim === 'screen'
        ? { width: 411, height: 914, scale: 2.625, fontScale: 1 }
        : { width: 411, height: 838, scale: 2.625, fontScale: 1 }
    );
    const engine = createJsEventEngine({ measure: () => ({ x: 0, y: 840, width: 411, height: 40 }) });
    const cb = jest.fn<void, [ViewportEntry]>();
    engine.observe(() => ({}), null, { thresholds: [1], targetMargin: normalizeMargin(0) }, cb);
    jest.advanceTimersByTime(16);
    expect(cb).toHaveBeenCalledWith(expect.objectContaining({ isIntersecting: true, intersectionRatio: 1 }));
    engine.dispose();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
});
