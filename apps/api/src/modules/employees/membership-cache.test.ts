import { ORG_ROLE } from "@haccp/shared";
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

const { membershipCache } = await import("./membership-cache.js");

const blob = {
  membershipId: "00000000-0000-4000-8000-0000000000m1",
  organizationId: "00000000-0000-4000-8000-0000000000o1",
  userId: "00000000-0000-4000-8000-0000000000u1",
  role: ORG_ROLE.EMPLOYEE,
  locationIds: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  withRedis.mockImplementation(async (fn: (client: typeof redis) => unknown) =>
    fn(redis),
  );
});

describe("membershipCache", () => {
  it("defaults to a 300-second (5-minute) TTL", async () => {
    await membershipCache.set("org_1", "user_1", blob);

    expect(redis.set).toHaveBeenCalledWith(
      "membership:clerk:org_1:user_1",
      JSON.stringify(blob),
      { EX: 300 },
    );
  });

  it("lets a caller override the TTL explicitly", async () => {
    await membershipCache.set("org_1", "user_1", blob, 60);

    expect(redis.set).toHaveBeenCalledWith(
      "membership:clerk:org_1:user_1",
      JSON.stringify(blob),
      { EX: 60 },
    );
  });

  it("treats a withRedis failure on get as a miss, not a throw", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis command timed out"));

    await expect(membershipCache.get("org_1", "user_1")).resolves.toBeNull();
  });

  it("swallows a withRedis failure on set without throwing", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis client is not ready"));

    await expect(
      membershipCache.set("org_1", "user_1", blob),
    ).resolves.toBeUndefined();
  });

  it("swallows a withRedis failure on invalidate without throwing", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis client is not ready"));

    await expect(
      membershipCache.invalidate("org_1", "user_1"),
    ).resolves.toBeUndefined();
  });
});
