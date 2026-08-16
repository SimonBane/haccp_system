const inflight = new Map<string, Promise<unknown>>();

// In-process only. Uniqueness is the real correctness; this just collapses duplicate Clerk calls.
export function singleFlight<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  const promise = (async () => fn())().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
