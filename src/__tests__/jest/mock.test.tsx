import React from 'react';
import { ScrollView, Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { mockAllInView, mockInView, resetViewportMock, setupViewportMock } from '../../jest';
import { InView } from '../../react/InView';
import { ViewportProvider } from '../../react/ViewportProvider';

const Card = ({ id }: { id: string }) => (
  <InView testID={id}>
    {({ inView, entry }) => (
      <Text testID={`${id}-state`}>{`${inView}:${entry?.intersectionRatio ?? '-'}`}</Text>
    )}
  </InView>
);

const tree = (
  <ViewportProvider>
    <ScrollView>
      <Card id="card-1" />
      <Card id="card-2" />
    </ScrollView>
  </ViewportProvider>
);

const text = (id: string) => screen.getByTestId(`${id}-state`).props.children;

beforeEach(() => setupViewportMock());
afterEach(() => resetViewportMock());

describe('jest mock', () => {
  it('marks every target visible', () => {
    render(tree);
    act(() => mockAllInView(true));
    expect(text('card-1')).toBe('true:1');
    expect(text('card-2')).toBe('true:1');
  });

  it('targets a single element by testID with a ratio', () => {
    render(tree);
    act(() => mockInView('card-2', 0.5));
    expect(text('card-1')).toBe('false:-');
    expect(text('card-2')).toBe('true:0.5');
  });

  it('applies the last mockAllInView value to targets mounted later', () => {
    act(() => mockAllInView(true));
    render(tree);
    expect(text('card-1')).toBe('true:1');
  });

  it('restores the real engine on reset', () => {
    resetViewportMock();
    expect(() => mockAllInView(true)).toThrow(/setupViewportMock/);
  });
});
