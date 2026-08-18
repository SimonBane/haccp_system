import { vi } from "vitest";
import { closeRedis, getRedis } from "../../../src/core/redis/client.js";

/** FLUSHDB, never FLUSHALL: the test index shares a server with the dev app. */
export async function flushTestRedis(): Promise<void> {
  const client = await getRedis();
  await client.flushDb();
}

type RedisCommand = "get" | "set" | "del" | "ping" | "flushDb";

/**
 * Fails specific commands while leaving the connection up. Exercises the real
 * fallback: cache modules swallow errors and read through to Postgres, which a
 * module-level mock of the cache would skip entirely. Returns a restore function.
 */
export async function failRedisCommands(
  ...commands: RedisCommand[]
): Promise<() => void> {
  // The client's commands are overloaded past what a dynamically keyed spy can
  // express, so narrow once here rather than casting at each call.
  const client = (await getRedis()) as unknown as Record<
    RedisCommand,
    (...args: unknown[]) => Promise<unknown>
  >;

  const spies = commands.map((command) =>
    vi
      .spyOn(client, command)
      .mockRejectedValue(new Error(`Redis ${command} failed (injected)`)),
  );

  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
}

/**
 * Hangs specific commands instead of rejecting them, leaving the connection
 * marked ready. Proves withRedis's COMMAND_TIMEOUT_MS bound actually fires,
 * rather than only exercising the fast-rejection path failRedisCommands covers.
 */
export async function hangRedisCommands(
  ...commands: RedisCommand[]
): Promise<() => void> {
  const client = (await getRedis()) as unknown as Record<
    RedisCommand,
    (...args: unknown[]) => Promise<unknown>
  >;

  const spies = commands.map((command) =>
    vi.spyOn(client, command).mockImplementation(() => new Promise(() => {})),
  );

  return () => {
    for (const spy of spies) {
      spy.mockRestore();
    }
  };
}

/**
 * Simulates Redis being unreachable: closes the live connection and stubs
 * .connect() to keep rejecting, so isReady/isOpen genuinely read false and
 * withRedis's request-path check sees a real outage, not a mocked command.
 * Goes through closeRedis() rather than a raw client.close()/destroy() call so
 * the module-private connectPromise is cleared too — otherwise getRedis() would
 * keep resolving the stale (now-closed) client without ever calling .connect()
 * again, for the rest of the (single-worker, shared-singleton) suite.
 */
export async function simulateRedisUnavailable(): Promise<() => Promise<void>> {
  const client = await getRedis();

  const connectSpy = vi
    .spyOn(client, "connect")
    .mockRejectedValue(new Error("Redis unavailable (injected)"));

  await closeRedis();

  return async () => {
    connectSpy.mockRestore();
    await getRedis();
  };
}
