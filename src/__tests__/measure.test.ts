import { __resetWarnings } from '../warnOnce';
import { getMeasureMode, measureRect, unstable_setMeasureMode } from '../measure';

const rect = { x: 1, y: 2, width: 3, height: 4 };

const syncNode = {
  getBoundingClientRect: () => rect,
  measureInWindow: (cb: (x: number, y: number, w: number, h: number) => void) => cb(9, 9, 9, 9),
};

beforeEach(() => {
  unstable_setMeasureMode('auto');
  __resetWarnings();
});

describe('measureRect', () => {
  it('defaults to auto mode', () => {
    expect(getMeasureMode()).toBe('auto');
  });

  it('reads synchronously when getBoundingClientRect exists', () => {
    const result = measureRect(syncNode);
    expect(result).not.toBeInstanceOf(Promise);
    expect(result).toEqual(rect);
  });

  it('uses measureInWindow in async mode', async () => {
    unstable_setMeasureMode('async');
    await expect(measureRect(syncNode)).resolves.toEqual({ x: 9, y: 9, width: 9, height: 9 });
  });

  it('falls back to measureInWindow when there is no sync read', async () => {
    const node = { measureInWindow: syncNode.measureInWindow };
    await expect(measureRect(node)).resolves.toEqual({ x: 9, y: 9, width: 9, height: 9 });
  });

  it('returns a zero rect for a node that cannot be measured', () => {
    expect(measureRect({})).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  });

  it('turns a throwing read into a zero rect and warns once', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const broken = {
      getBoundingClientRect: () => {
        throw new Error('boom');
      },
    };
    expect(measureRect(broken)).toEqual({ x: 0, y: 0, width: 0, height: 0 });
    measureRect(broken);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
