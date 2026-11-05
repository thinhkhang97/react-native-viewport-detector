import React, { useCallback } from 'react';
import { warnOnce } from '../warnOnce';
import { composeHandlers, isFunctionHandler } from './composeHandlers';
import { useNativeScrollFallback } from './useNativeScrollFallback';
import { useViewportRoot, type ViewportRootOptions } from './useViewportRoot';

export interface ViewportProviderProps extends ViewportRootOptions {
  /** A single scrollable element (ScrollView, FlatList, Animated.ScrollView, ...). */
  children: React.ReactElement;
}

type AnyProps = Record<string, unknown>;
type Ref<T> = ((value: T) => void) | { current: T } | null | undefined;

const REACT_MAJOR = parseInt(React.version, 10);

function childRefOf(child: React.ReactElement): Ref<unknown> {
  const fromProps = (child.props as AnyProps).ref as Ref<unknown>;
  // React 18 keeps the ref on the element; React 19 moved it to props (and warns on element.ref).
  return fromProps ?? (REACT_MAJOR < 19 ? ((child as unknown as { ref?: Ref<unknown> }).ref ?? null) : null);
}

function assignRef<T>(ref: Ref<T>, value: T) {
  if (typeof ref === 'function') ref(value);
  else if (ref) ref.current = value;
}

type HandlerMap = Record<string, unknown>;

/** For every key any source handles: the child's own handler first, then each library handler. */
function composeProps(props: AnyProps, ...sources: HandlerMap[]): AnyProps {
  const keys = new Set(sources.flatMap(source => Object.keys(source)));
  const next: AnyProps = {};
  keys.forEach(key => {
    const handlers = sources.map(source => source[key]).filter(isFunctionHandler);
    if (handlers.length === 0) return;
    const own = props[key];
    next[key] = composeHandlers(isFunctionHandler(own) ? own : undefined, ...handlers);
  });
  return next;
}

/** Wraps one scrollable child and makes it a visibility root for every `useInView` below it. */
export function ViewportProvider({ children, ...options }: ViewportProviderProps) {
  const root = useViewportRoot(options);
  const child = React.Children.only(children);
  const props = child.props as AnyProps;
  const nativeDriverScroll = props.onScroll != null && !isFunctionHandler(props.onScroll);
  const fallback = useNativeScrollFallback(nativeDriverScroll, root.scrollProps.onScroll);

  if (nativeDriverScroll) {
    warnOnce(
      'native-driver-scroll',
      'ViewportProvider: onScroll is a native-driver Animated.event, so JS gets no scroll events. ' +
        'Visibility is re-checked every frame only while the list is touched or scrolling.'
    );
  }

  const childRef = childRefOf(child);
  const rootRef = root.ref;
  const ref = useCallback(
    (node: object | null) => {
      assignRef(childRef, node);
      rootRef(node);
    },
    [childRef, rootRef]
  );

  const { scrollEventThrottle, onScroll, ...rest } = root.scrollProps;
  const library = nativeDriverScroll ? rest : { ...rest, onScroll };
  const injected = {
    ...composeProps(props, library as HandlerMap, (fallback ?? {}) as HandlerMap),
    scrollEventThrottle: (props.scrollEventThrottle as number | undefined) ?? scrollEventThrottle,
    ref,
  };

  return <root.Provider>{React.cloneElement(child, injected)}</root.Provider>;
}
