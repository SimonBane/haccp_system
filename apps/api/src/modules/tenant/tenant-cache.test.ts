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

const { tenantCache } = await import("./tenant-cache.js");

const blob = {
  organization: {
    id: "00000000-0000-4000-8000-000000000001",
    clerkOrgId: "org_1",
    name: "Test Org",
    imageUrl: "",
    hasImage: false,
    timezone: "Europe/Sofia",
    locale: "bg" as const,
    multipleLocationsEnabled: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  locations: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      organizationId: "00000000-0000-4000-8000-000000000001",
      name: "Main",
      isDefault: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  withRedis.mockImplementation(async (fn: (client: typeof redis) => unknown) =>
    fn(redis),
  );
});

describe("tenantCache", () => {
  it("treats a withRedis failure on get as a miss, not a throw", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis command timed out"));

    await expect(tenantCache.get("org_1")).resolves.toBeNull();
  });

  it("swallows a withRedis failure on set without throwing", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis client is not ready"));

    await expect(tenantCache.set("org_1", blob)).resolves.toBeUndefined();
  });

  it("swallows a withRedis failure on invalidate without throwing", async () => {
    withRedis.mockRejectedValueOnce(new Error("Redis client is not ready"));

    await expect(tenantCache.invalidate("org_1")).resolves.toBeUndefined();
  });

  it("round-trips a cached blob through get after a successful set", async () => {
    redis.get.mockResolvedValueOnce(JSON.stringify(blob));

    await expect(tenantCache.get("org_1")).resolves.toEqual(blob);
  });
});
