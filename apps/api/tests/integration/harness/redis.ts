import { vi } from "vitest";
import { getRedis } from "../../../src/core/redis/client.js";

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
