import React from 'react';
import { ScrollView, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { ViewPortDetector } from '../../compat/ViewPortDetector';
import { ViewPortDetectorProvider } from '../../compat/ViewPortDetectorProvider';
import { ViewportProvider } from '../../react/ViewportProvider';
import { __resetWarnings } from '../../warnOnce';

declare const global: { __DEV__: boolean };

let warn: jest.SpyInstance;

beforeEach(() => {
  __resetWarnings();
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warn.mockRestore();
  global.__DEV__ = true;
});

const v1Tree = () => (
  <ViewPortDetectorProvider>
    <View>
      <ViewPortDetector onChange={() => {}}>
        <View />
      </ViewPortDetector>
      <ViewPortDetector onChange={() => {}}>
        <View />
      </ViewPortDetector>
    </View>
  </ViewPortDetectorProvider>
);

describe('v1 deprecation warnings', () => {
  it('warns once per v1 export in development', () => {
    render(v1Tree());
    const deprecations = warn.mock.calls.filter(([m]) => String(m).includes('docs/MIGRATION.md'));
    expect(deprecations).toHaveLength(2);
  });

  it('stays silent in production', () => {
    global.__DEV__ = false;
    render(v1Tree());
    expect(warn).not.toHaveBeenCalled();
  });
});

describe('v1 detector inside a v2 provider', () => {
  it('keeps polling on its interval', () => {
    jest.useFakeTimers();
    const measureInWindow = jest.spyOn(
      View.prototype as unknown as { measureInWindow: (cb: () => void) => void },
      'measureInWindow'
    );
    render(
      <ViewportProvider>
        <ScrollView>
          <ViewPortDetector onChange={() => {}} frequency={200}>
            <View />
          </ViewPortDetector>
        </ScrollView>
      </ViewportProvider>
    );
    measureInWindow.mockClear();
    jest.advanceTimersByTime(1000);
    expect(measureInWindow.mock.calls.length).toBeGreaterThanOrEqual(5);
    measureInWindow.mockRestore();
    jest.useRealTimers();
  });
});
