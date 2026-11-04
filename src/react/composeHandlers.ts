type Handler<E> = ((event: E) => void) | undefined | null;

/** Calls every handler in order; the user's handler always runs first. */
export function composeHandlers<E>(...handlers: Array<Handler<E>>): (event: E) => void {
  return event => {
    handlers.forEach(handler => handler?.(event));
  };
}

export function isFunctionHandler(handler: unknown): handler is (event: unknown) => void {
  return typeof handler === 'function';
}
