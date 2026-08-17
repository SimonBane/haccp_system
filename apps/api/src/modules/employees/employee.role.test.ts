import { ClerkAPIResponseError } from "@clerk/backend/errors";
import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import { ServiceUnavailableError } from "../../core/errors/app-errors.js";

const clerkClient = vi.hoisted(() => ({
  organizations: { updateOrganizationMembership: vi.fn() },
}));
const employeeRepository = vi.hoisted(() => ({
  updateByIdAndOrganization: vi.fn(),
}));
const membershipCache = vi.hoisted(() => ({ invalidate: vi.fn() }));

vi.mock("../../core/auth/clerk-client.js", () => ({ clerkClient }));
vi.mock("./employee.repository.js", () => ({ employeeRepository }));
vi.mock("./membership-cache.js", () => ({ membershipCache }));

const { changeActiveEmployeeRole } = await import("./employee.role.js");

const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000o1";
const MEMBERSHIP_ID = "00000000-0000-4000-8000-0000000000m1";
const CLERK_ORG_ID = "org_test";
const CLERK_USER_ID = "user_test";

const membershipRow = {
  id: MEMBERSHIP_ID,
  organizationId: ORGANIZATION_ID,
  userId: "00000000-0000-4000-8000-0000000000u1",
  role: ORG_ROLE.EMPLOYEE,
  status: MEMBERSHIP_STATUS.ACTIVE,
  clerkInvitationId: null,
  invitedAt: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const db = {} as never;

const params = {
  organizationId: ORGANIZATION_ID,
  clerkOrgId: CLERK_ORG_ID,
  clerkUserId: CLERK_USER_ID,
  membershipId: MEMBERSHIP_ID,
  role: ORG_ROLE.ADMIN,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("changeActiveEmployeeRole", () => {
  it("updates Clerk first, then writes the role Clerk confirmed and invalidates the cache", async () => {
    clerkClient.organizations.updateOrganizationMembership.mockResolvedValue({
      role: ORG_ROLE.ADMIN,
    });
    employeeRepository.updateByIdAndOrganization.mockResolvedValue({
      ...membershipRow,
      role: ORG_ROLE.ADMIN,
    });

    const result = await changeActiveEmployeeRole(db, params);

    expect(clerkClient.organizations.updateOrganizationMembership).toHaveBeenCalledWith({
      organizationId: CLERK_ORG_ID,
      userId: CLERK_USER_ID,
      role: ORG_ROLE.ADMIN,
    });
    expect(employeeRepository.updateByIdAndOrganization).toHaveBeenCalledWith(
      db,
      ORGANIZATION_ID,
      MEMBERSHIP_ID,
      { role: ORG_ROLE.ADMIN },
    );
    expect(membershipCache.invalidate).toHaveBeenCalledWith(CLERK_ORG_ID, CLERK_USER_ID);
    expect(result.role).toBe(ORG_ROLE.ADMIN);
  });

  it("writes the role from Clerk's response, not the role that was requested", async () => {
    // Simulates Clerk settling on a different role than requested (e.g. a concurrent change) —
    // the local projection must reflect what Clerk actually confirmed.
    clerkClient.organizations.updateOrganizationMembership.mockResolvedValue({
      role: ORG_ROLE.EMPLOYEE,
    });
    employeeRepository.updateByIdAndOrganization.mockResolvedValue({
      ...membershipRow,
      role: ORG_ROLE.EMPLOYEE,
    });

    await changeActiveEmployeeRole(db, params);

    expect(employeeRepository.updateByIdAndOrganization).toHaveBeenCalledWith(
      db,
      ORGANIZATION_ID,
      MEMBERSHIP_ID,
      { role: ORG_ROLE.EMPLOYEE },
    );
  });

  it("leaves Postgres and the cache untouched when Clerk rejects the update", async () => {
    clerkClient.organizations.updateOrganizationMembership.mockRejectedValue(
      new ClerkAPIResponseError("Clerk is unavailable", { status: 500, data: [] }),
    );

    await expect(changeActiveEmployeeRole(db, params)).rejects.toBeInstanceOf(
      ServiceUnavailableError,
    );

    expect(employeeRepository.updateByIdAndOrganization).not.toHaveBeenCalled();
    expect(membershipCache.invalidate).not.toHaveBeenCalled();
  });

  it("leaves Postgres and the cache untouched when Clerk times out", async () => {
    clerkClient.organizations.updateOrganizationMembership.mockReturnValue(
      new Promise(() => {}),
    );

    const pending = changeActiveEmployeeRole(db, params);
    await expect(pending).rejects.toBeInstanceOf(ServiceUnavailableError);

    expect(employeeRepository.updateByIdAndOrganization).not.toHaveBeenCalled();
    expect(membershipCache.invalidate).not.toHaveBeenCalled();
  }, 7000);
});
