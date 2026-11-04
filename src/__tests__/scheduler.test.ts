import { createFrameScheduler } from '../scheduler';

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

describe('createFrameScheduler', () => {
  it('coalesces many requests into one frame', () => {
    const run = jest.fn();
    const scheduler = createFrameScheduler(run);
    for (let i = 0; i < 5; i++) scheduler.request();
    expect(run).not.toHaveBeenCalled();
    jest.advanceTimersByTime(16);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not run after cancel', () => {
    const run = jest.fn();
    const scheduler = createFrameScheduler(run);
    scheduler.request();
    scheduler.cancel();
    jest.advanceTimersByTime(16);
    expect(run).not.toHaveBeenCalled();
  });

  it('leaves no timers behind once the frame ran', () => {
    const scheduler = createFrameScheduler(jest.fn());
    scheduler.request();
    expect(scheduler.isPending()).toBe(true);
    jest.advanceTimersByTime(16);
    expect(scheduler.isPending()).toBe(false);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('keeps working after run throws', () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    const run = jest.fn().mockImplementationOnce(() => {
      throw new Error('boom');
    });
    const scheduler = createFrameScheduler(run);
    scheduler.request();
    jest.advanceTimersByTime(16);
    scheduler.request();
    jest.advanceTimersByTime(16);
    expect(run).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    error.mockRestore();
  });
});
