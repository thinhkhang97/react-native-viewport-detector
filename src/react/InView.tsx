import React from 'react';
import { View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import type { ViewportEntry } from '../types';
import { composeHandlers } from './composeHandlers';
import { useInViewState, type UseInViewOptions } from './useInView';

type RenderChildren = (state: { inView: boolean; entry?: ViewportEntry }) => React.ReactNode;

export type InViewProps = UseInViewOptions &
  Omit<ViewProps, 'children'> & {
    children?: React.ReactNode | RenderChildren;
  };

/** A `View` that tracks its own visibility; children may be nodes or a render function. */
export function InView({
  children,
  threshold,
  rootMargin,
  triggerOnce,
  skip,
  initialInView,
  delay,
  onChange,
  root,
  onLayout,
  ...viewProps
}: InViewProps) {
  const renderFunction = typeof children === 'function';
  const { ref, inView, entry, invalidate } = useInViewState(
    { threshold, rootMargin, triggerOnce, skip, initialInView, delay, onChange, root },
    { trackState: renderFunction }
  );
  return (
    <View
      {...viewProps}
      ref={ref}
      collapsable={false}
      onLayout={composeHandlers<LayoutChangeEvent>(onLayout, invalidate)}
    >
      {renderFunction ? (children as RenderChildren)({ inView, entry }) : children}
    </View>
  );
}
