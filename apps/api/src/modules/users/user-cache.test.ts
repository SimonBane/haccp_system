import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));
const withRedis = vi.hoisted(() =>
  vi.fn(async (fn: (client: typeof redis) => unknown) => fn(redis)),
);

vi.mock("../../core/redis/client.js", () => ({ withRedis }));

const { userCache } = await import("./user-cache.js");

const blob = {
  id: "00000000-0000-4000-8000-000000000001",
  clerkUserId: "user_1",
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  imageUrl: "",
  hasImage: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  withRedis.mockImplementation(async (fn: (client: typeof redis) => unknown) =>
    fn(redis),
  );
});

describe("userCache", () => {
  it("treats a withRedis failure on get as a miss, not a throw", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis command timed out"));

    await expect(userCache.get("user_1")).resolves.toBeNull();
  });

  it("swallows a withRedis failure on set without throwing", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis client is not ready"));

    await expect(userCache.set("user_1", blob)).resolves.toBeUndefined();
  });

  it("swallows a withRedis failure on invalidate without throwing", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis client is not ready"));

    await expect(userCache.invalidate("user_1")).resolves.toBeUndefined();
  });

  it("round-trips a cached blob through get after a successful set", async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(blob));

    await expect(userCache.get("user_1")).resolves.toEqual(blob);
  });
});
