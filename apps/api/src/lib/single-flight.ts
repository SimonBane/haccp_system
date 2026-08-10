const inflight = new Map<string, Promise<unknown>>();

// Collapses concurrent identical provisioning attempts within one process. Purely
// an optimization to avoid duplicate Clerk API calls — correctness comes from the
// unique indexes, so this never needs to work across instances.
export function singleFlight<T>(
  key: string,
  fn: () => Promise<T>,
): Promise<T> {
  const existing = inflight.get(key);
  if (existing) {
    return existing as Promise<T>;
  }

  // Wrapped so a synchronous throw from fn still clears the key.
  const promise = (async () => fn())().finally(() => {
    inflight.delete(key);
  });

  inflight.set(key, promise);
  return promise;
}
