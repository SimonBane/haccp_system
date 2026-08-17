import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import {
  ForbiddenError,
  RoleProjectionFailedError,
  RoleUpdateOutcomeUnknownError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const ORG = "00000000-0000-4000-8000-00000000000o";
const MEMBERSHIP = "00000000-0000-4000-8000-00000000000m";
const TARGET_USER = "00000000-0000-4000-8000-00000000000u";
const ACTOR_USER_DB_ID = "00000000-0000-4000-8000-00000000000a";
const LOCATION = "00000000-0000-4000-8000-00000000000l";
const CLERK_ORG = "org_abc";
const CLERK_TARGET_USER = "user_target";
const CLERK_ACTOR_USER = "user_actor";

const employeeRepository = vi.hoisted(() => ({
  findDetailById: vi.fn(),
  countActiveAdmins: vi.fn(),
  updateRoleFromClerkByIdAndOrganization: vi.fn(),
  updateByIdAndOrganization: vi.fn(),
  replaceLocationAssignments: vi.fn(),
}));
const membershipCache = vi.hoisted(() => ({ invalidate: vi.fn() }));
const clerkCalls = vi.hoisted(() => ({
  updateClerkMembershipRole: vi.fn(),
  fetchClerkMembershipRole: vi.fn(),
}));
const invitations = vi.hoisted(() => ({ issueMembershipInvitation: vi.fn() }));
const audit = vi.hoisted(() => ({ logRoleChange: vi.fn() }));

vi.mock("./employee.repository.js", () => ({ employeeRepository }));
vi.mock("./membership-cache.js", () => ({ membershipCache }));
vi.mock("./employee.clerk.js", () => clerkCalls);
vi.mock("./employee.invitations.js", () => invitations);
vi.mock("./employee.audit.js", () => audit);

const { employeeRoleService } = await import("./employee.role.service.js");

const db = { transaction: async (cb: (tx: unknown) => unknown) => cb(db) } as never;

const tenantLocations = [
  {
    id: LOCATION,
    organizationId: ORG,
    name: "Main",
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

const actor = {
  actorUserDbId: ACTOR_USER_DB_ID,
  actorClerkUserId: CLERK_ACTOR_USER,
};

function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: TARGET_USER,
    clerkUserId: CLERK_TARGET_USER,
    firstName: "Emil",
    lastName: "Employee",
    email: "emil@example.test",
    imageUrl: "",
    hasImage: false,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function membershipRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MEMBERSHIP,
    organizationId: ORG,
    userId: TARGET_USER,
    role: ORG_ROLE.EMPLOYEE,
    status: MEMBERSHIP_STATUS.ACTIVE,
    clerkInvitationId: null,
    invitedAt: null,
    clerkRoleUpdatedAt: null,
    deletedAt: null,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

function detail(overrides: {
  membership?: Partial<Record<string, unknown>>;
  locationIds?: string[];
} = {}) {
  return {
    membership: membershipRow(overrides.membership),
    user: userRow(),
    locationIds: overrides.locationIds ?? [LOCATION],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  employeeRepository.countActiveAdmins.mockResolvedValue(5);
  employeeRepository.replaceLocationAssignments.mockResolvedValue(undefined);
  membershipCache.invalidate.mockResolvedValue(undefined);
});

describe("employeeRoleService.changeRole — active membership", () => {
  it("writes the local projection from the role Clerk actually confirms, even when local was stale", async () => {
    const current = detail({ membership: { role: ORG_ROLE.EMPLOYEE } });
    employeeRepository.findDetailById.mockResolvedValue(current);
    clerkCalls.updateClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.ADMIN,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockResolvedValue(
      membershipRow({ role: ORG_ROLE.ADMIN, clerkRoleUpdatedAt: new Date("2026-01-02T00:00:00Z") }),
    );

    const response = await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations,
    );

    expect(clerkCalls.updateClerkMembershipRole).toHaveBeenCalledWith(
      CLERK_ORG, CLERK_TARGET_USER, ORG_ROLE.ADMIN,
    );
    expect(employeeRepository.updateRoleFromClerkByIdAndOrganization).toHaveBeenCalledWith(
      db, ORG, MEMBERSHIP, ORG_ROLE.ADMIN, new Date("2026-01-02T00:00:00Z"),
    );
    expect(response.role).toBe(ORG_ROLE.ADMIN);
    expect(membershipCache.invalidate).toHaveBeenCalledWith(CLERK_ORG, CLERK_TARGET_USER);
    expect(audit.logRoleChange).toHaveBeenCalledWith(
      expect.objectContaining({ stage: "applied", authoritativeRole: ORG_ROLE.ADMIN }),
    );
  });

  it("promotion leaves existing location rows untouched", async () => {
    const current = detail({ membership: { role: ORG_ROLE.EMPLOYEE }, locationIds: [LOCATION] });
    employeeRepository.findDetailById.mockResolvedValue(current);
    clerkCalls.updateClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.ADMIN,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockResolvedValue(
      membershipRow({ role: ORG_ROLE.ADMIN }),
    );

    await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations,
    );

    expect(employeeRepository.replaceLocationAssignments).not.toHaveBeenCalled();
  });

  it("demotion assigns the default location only when none remain", async () => {
    const current = detail({ membership: { role: ORG_ROLE.ADMIN }, locationIds: [] });
    employeeRepository.findDetailById.mockResolvedValue(current);
    clerkCalls.updateClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.EMPLOYEE,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockResolvedValue(
      membershipRow({ role: ORG_ROLE.EMPLOYEE }),
    );

    const response = await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.EMPLOYEE, tenantLocations,
    );

    expect(employeeRepository.replaceLocationAssignments).toHaveBeenCalledWith(
      db, MEMBERSHIP, ORG, [LOCATION],
    );
    expect(response.locationIds).toEqual([LOCATION]);
  });

  it("rejects and leaves the local projection untouched when Clerk definitively rejects", async () => {
    employeeRepository.findDetailById.mockResolvedValue(detail());
    const rejection = new ValidationError("The selected organization role is not available");
    clerkCalls.updateClerkMembershipRole.mockRejectedValue(rejection);

    await expect(
      employeeRoleService.changeRole(db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations),
    ).rejects.toBe(rejection);

    expect(employeeRepository.updateRoleFromClerkByIdAndOrganization).not.toHaveBeenCalled();
    expect(membershipCache.invalidate).not.toHaveBeenCalled();
    expect(audit.logRoleChange).toHaveBeenCalledWith(expect.objectContaining({ stage: "rejected" }));
  });

  it("times out before applying — the re-read observes the previous role and the caller sees outcome-unknown", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { role: ORG_ROLE.EMPLOYEE } }),
    );
    clerkCalls.updateClerkMembershipRole.mockRejectedValue(new RoleUpdateOutcomeUnknownError());
    clerkCalls.fetchClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.EMPLOYEE, // unchanged — the write never applied
      updatedAt: new Date("2026-01-01T00:00:00Z"),
    });

    await expect(
      employeeRoleService.changeRole(db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations),
    ).rejects.toBeInstanceOf(RoleUpdateOutcomeUnknownError);

    expect(employeeRepository.updateRoleFromClerkByIdAndOrganization).not.toHaveBeenCalled();
    expect(audit.logRoleChange).toHaveBeenCalledWith(expect.objectContaining({ stage: "outcome_unknown" }));
  });

  it("times out after applying — the re-read observes the requested role and the projection converges", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { role: ORG_ROLE.EMPLOYEE } }),
    );
    clerkCalls.updateClerkMembershipRole.mockRejectedValue(new RoleUpdateOutcomeUnknownError());
    clerkCalls.fetchClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.ADMIN, // it did apply, the ack was just lost
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockResolvedValue(
      membershipRow({ role: ORG_ROLE.ADMIN }),
    );

    const response = await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations,
    );

    expect(response.role).toBe(ORG_ROLE.ADMIN);
    expect(employeeRepository.updateRoleFromClerkByIdAndOrganization).toHaveBeenCalledWith(
      db, ORG, MEMBERSHIP, ORG_ROLE.ADMIN, new Date("2026-01-02T00:00:00Z"),
    );
  });

  it("does not roll Clerk back when the local projection write fails after Clerk succeeds", async () => {
    employeeRepository.findDetailById.mockResolvedValue(detail());
    clerkCalls.updateClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.ADMIN,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockRejectedValue(
      new Error("connection lost"),
    );

    await expect(
      employeeRoleService.changeRole(db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations),
    ).rejects.toBeInstanceOf(RoleProjectionFailedError);

    // Clerk was called and nothing attempts to undo it — no compensating call exists.
    expect(clerkCalls.updateClerkMembershipRole).toHaveBeenCalledTimes(1);
    expect(membershipCache.invalidate).toHaveBeenCalledWith(CLERK_ORG, CLERK_TARGET_USER);
    expect(audit.logRoleChange).toHaveBeenCalledWith(expect.objectContaining({ stage: "projection_failed" }));
  });

  it("converges to a newer concurrent write instead of erroring when the ordering guard rejects the update", async () => {
    employeeRepository.findDetailById
      .mockResolvedValueOnce(detail({ membership: { role: ORG_ROLE.EMPLOYEE } }))
      // Re-fetch inside the transaction: a concurrent, newer request already won.
      .mockResolvedValueOnce(detail({ membership: { role: ORG_ROLE.ADMIN } }));
    clerkCalls.updateClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.EMPLOYEE,
      updatedAt: new Date("2026-01-01T12:00:00Z"),
    });
    // The conditional write loses the race — clerk_role_updated_at guard rejected it.
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockResolvedValue(null);

    const response = await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.EMPLOYEE, tenantLocations,
    );

    expect(response.role).toBe(ORG_ROLE.ADMIN);
  });

  it("always calls Clerk for a retry, even when the local row already holds the requested role", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { role: ORG_ROLE.EMPLOYEE } }),
    );
    clerkCalls.updateClerkMembershipRole.mockResolvedValue({
      role: ORG_ROLE.EMPLOYEE,
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });
    employeeRepository.updateRoleFromClerkByIdAndOrganization.mockResolvedValue(
      membershipRow({ role: ORG_ROLE.EMPLOYEE }),
    );

    await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.EMPLOYEE, tenantLocations,
    );

    expect(clerkCalls.updateClerkMembershipRole).toHaveBeenCalledTimes(1);
  });

  it("blocks self-demotion before contacting Clerk", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { userId: ACTOR_USER_DB_ID } }),
    );

    await expect(
      employeeRoleService.changeRole(db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(clerkCalls.updateClerkMembershipRole).not.toHaveBeenCalled();
  });

  it("blocks demoting the organization's last active admin before contacting Clerk", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { role: ORG_ROLE.ADMIN } }),
    );
    employeeRepository.countActiveAdmins.mockResolvedValue(0);

    await expect(
      employeeRoleService.changeRole(db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.EMPLOYEE, tenantLocations),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(employeeRepository.countActiveAdmins).toHaveBeenCalledWith(db, ORG, MEMBERSHIP);
    expect(clerkCalls.updateClerkMembershipRole).not.toHaveBeenCalled();
  });
});

describe("employeeRoleService.changeRole — draft membership", () => {
  it("writes the role locally with no Clerk call", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { status: MEMBERSHIP_STATUS.DRAFT, role: ORG_ROLE.EMPLOYEE } }),
    );
    employeeRepository.updateByIdAndOrganization.mockResolvedValue(
      membershipRow({ status: MEMBERSHIP_STATUS.DRAFT, role: ORG_ROLE.ADMIN }),
    );

    const response = await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations,
    );

    expect(response.role).toBe(ORG_ROLE.ADMIN);
    expect(clerkCalls.updateClerkMembershipRole).not.toHaveBeenCalled();
    expect(clerkCalls.fetchClerkMembershipRole).not.toHaveBeenCalled();
  });

  it("is a no-op when the requested role already matches", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { status: MEMBERSHIP_STATUS.DRAFT, role: ORG_ROLE.EMPLOYEE } }),
    );

    await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.EMPLOYEE, tenantLocations,
    );

    expect(employeeRepository.updateByIdAndOrganization).not.toHaveBeenCalled();
  });
});

describe("employeeRoleService.changeRole — invited membership", () => {
  it("revokes and reissues the invitation with the new role", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({
        membership: {
          status: MEMBERSHIP_STATUS.INVITED,
          role: ORG_ROLE.EMPLOYEE,
          clerkInvitationId: "inv_old",
        },
      }),
    );
    invitations.issueMembershipInvitation.mockResolvedValue(
      membershipRow({ status: MEMBERSHIP_STATUS.INVITED, role: ORG_ROLE.ADMIN, clerkInvitationId: "inv_new" }),
    );

    const response = await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.ADMIN, tenantLocations,
    );

    expect(invitations.issueMembershipInvitation).toHaveBeenCalledWith(
      db, ORG, MEMBERSHIP,
      expect.objectContaining({ role: ORG_ROLE.ADMIN, clerkOrgId: CLERK_ORG }),
      { previousInvitationId: "inv_old" },
    );
    expect(response.role).toBe(ORG_ROLE.ADMIN);
  });

  it("is a no-op when the requested role already matches", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({
        membership: {
          status: MEMBERSHIP_STATUS.INVITED,
          role: ORG_ROLE.EMPLOYEE,
          clerkInvitationId: "inv_old",
        },
      }),
    );

    await employeeRoleService.changeRole(
      db, ORG, CLERK_ORG, "bg", actor, MEMBERSHIP, ORG_ROLE.EMPLOYEE, tenantLocations,
    );

    expect(invitations.issueMembershipInvitation).not.toHaveBeenCalled();
  });
});
