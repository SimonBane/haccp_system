import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";

const redis = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  del: vi.fn(),
}));
const getRedis = vi.hoisted(() => vi.fn(async () => redis));

vi.mock("../../core/redis/client.js", () => ({ getRedis }));

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
});
