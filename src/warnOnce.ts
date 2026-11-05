const warned = new Set<string>();

/** Logs a dev-only warning the first time a given key is seen. */
export function warnOnce(key: string, message: string): void {
  if (!__DEV__ || warned.has(key)) {
    return;
  }
  warned.add(key);
  console.warn(message);
}

/** Test-only: forget which warnings were already shown. */
export function __resetWarnings(): void {
  warned.clear();
}
