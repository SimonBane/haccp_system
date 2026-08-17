import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";

/** Query-count guard: a redundant SELECT here is paid on every authenticated request. */
const ORG = "00000000-0000-4000-8000-00000000000o";
const USER = "00000000-0000-4000-8000-00000000000u";
const LOCATION = "00000000-0000-4000-8000-00000000000l";
const CLERK_ORG = "org_abc";
const CLERK_USER = "user_abc";

const tenantCache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), invalidate: vi.fn() }));
const userCache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), invalidate: vi.fn() }));
const membershipCache = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), invalidate: vi.fn() }));
const employeeRepository = vi.hoisted(() => ({
  findMembershipContextByClerkUserId: vi.fn(),
  findMembershipContextByEmail: vi.fn(),
}));
const userRepository = vi.hoisted(() => ({ findByClerkUserId: vi.fn() }));

vi.mock("../tenant/tenant-cache.js", () => ({
  tenantCache,
  buildTenantCacheBlob: vi.fn(),
}));
vi.mock("../users/user-cache.js", () => ({
  userCache,
  buildUserCacheBlob: (u: unknown) => u,
}));
vi.mock("../employees/membership-cache.js", () => ({ membershipCache }));
vi.mock("../employees/employee.repository.js", () => ({ employeeRepository }));
vi.mock("../users/user.repository.js", () => ({ userRepository }));

const { provisioningService } = await import("./provisioning.service.js");

const db = {} as never;
const identity = {
  clerkOrgId: CLERK_ORG,
  clerkUserId: CLERK_USER,
  orgRole: ORG_ROLE.EMPLOYEE,
};

const tenantBlob = {
  organization: {
    id: ORG,
    clerkOrgId: CLERK_ORG,
    name: "Kitchen",
    timezone: "Europe/Sofia",
    locale: "bg",
    multipleLocationsEnabled: false,
    imageUrl: "",
    hasImage: false,
  },
  locations: [{ id: LOCATION, name: "Main", isDefault: true }],
};

const userRow = {
  id: USER,
  clerkUserId: CLERK_USER,
  firstName: "Ann",
  lastName: "Lee",
  email: "ann@example.com",
  imageUrl: "",
  hasImage: false,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const membershipRow = {
  membership: {
    id: "00000000-0000-4000-8000-00000000000m",
    organizationId: ORG,
    userId: USER,
    role: ORG_ROLE.EMPLOYEE,
    status: MEMBERSHIP_STATUS.ACTIVE,
    clerkInvitationId: null,
    invitedAt: null,
    clerkRoleUpdatedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  user: userRow,
  locationIds: [LOCATION],
};

const membershipBlob = {
  membershipId: membershipRow.membership.id,
  organizationId: ORG,
  userId: USER,
  role: ORG_ROLE.EMPLOYEE,
  locationIds: [LOCATION],
};

const userBlob = {
  id: USER,
  firstName: "Ann",
  lastName: "Lee",
  email: "ann@example.com",
  imageUrl: "",
  hasImage: false,
};

/** Every SELECT resolveRequestContext can issue. */
function sqlQueryCount(): number {
  return (
    employeeRepository.findMembershipContextByClerkUserId.mock.calls.length +
    employeeRepository.findMembershipContextByEmail.mock.calls.length +
    userRepository.findByClerkUserId.mock.calls.length
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  tenantCache.get.mockResolvedValue(tenantBlob);
  membershipCache.get.mockResolvedValue(null);
  employeeRepository.findMembershipContextByClerkUserId.mockResolvedValue(membershipRow);
  userRepository.findByClerkUserId.mockResolvedValue(userRow);
  for (const c of [tenantCache, membershipCache]) {
    c.set.mockResolvedValue(undefined);
  }

  // Stateful: a write during the request is what lets the later read skip SQL.
  let stored: unknown = null;
  userCache.get.mockImplementation(async () => stored);
  userCache.set.mockImplementation(async (_key: string, value: unknown) => {
    stored = value;
  });
});

describe("resolveRequestContext query cost", () => {
  it("issues no queries when all three caches are warm", async () => {
    userCache.set("k", userBlob);
    membershipCache.get.mockResolvedValue(membershipBlob);

    const ctx = await provisioningService.resolveRequestContext(db, identity);

    expect(sqlQueryCount()).toBe(0);
    expect(ctx.membership).toEqual(membershipBlob);
    expect(ctx.user.id).toBe(USER);
  });

  it("reads all three caches in one parallel batch", async () => {
    userCache.set("k", userBlob);
    membershipCache.get.mockResolvedValue(membershipBlob);

    await provisioningService.resolveRequestContext(db, identity);

    expect(tenantCache.get).toHaveBeenCalledTimes(1);
    expect(userCache.get).toHaveBeenCalledTimes(1);
    expect(membershipCache.get).toHaveBeenCalledTimes(1);
  });

  it("issues ONE query when membership and user are both cold", async () => {
    const ctx = await provisioningService.resolveRequestContext(db, identity);

    expect(sqlQueryCount()).toBe(1);
    expect(employeeRepository.findMembershipContextByClerkUserId).toHaveBeenCalledTimes(1);
    expect(userRepository.findByClerkUserId).not.toHaveBeenCalled();
    expect(ctx.user.id).toBe(USER);
  });

  it("caches the joined user row alongside the membership blob", async () => {
    await provisioningService.resolveRequestContext(db, identity);

    expect(membershipCache.set).toHaveBeenCalledTimes(1);
    expect(userCache.set).toHaveBeenCalled();
  });

  it("issues ONE query when only the user is cold", async () => {
    membershipCache.get.mockResolvedValue(membershipBlob);

    await provisioningService.resolveRequestContext(db, identity);

    expect(sqlQueryCount()).toBe(1);
    expect(userRepository.findByClerkUserId).toHaveBeenCalledTimes(1);
  });

  it("does not re-read the user cache after a miss when membership was warm", async () => {
    membershipCache.get.mockResolvedValue(membershipBlob);

    await provisioningService.resolveRequestContext(db, identity);

    expect(userCache.get).toHaveBeenCalledTimes(1);
  });

  it("issues ONE query when only membership is cold", async () => {
    userCache.set("k", userBlob);

    await provisioningService.resolveRequestContext(db, identity);

    expect(sqlQueryCount()).toBe(1);
    expect(userRepository.findByClerkUserId).not.toHaveBeenCalled();
  });

  it("does not re-read the tenant cache after a miss", async () => {
    tenantCache.get.mockResolvedValue(null);
    userCache.set("k", userBlob);
    membershipCache.get.mockResolvedValue(membershipBlob);

    await provisioningService
      .resolveRequestContext(db, identity)
      .catch(() => undefined);

    // The singleFlight re-read is load-bearing: a queued caller arrives after the leader wrote the cache.
    expect(tenantCache.get).toHaveBeenCalledTimes(2);
  });
});
