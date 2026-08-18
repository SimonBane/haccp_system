import { ORG_ROLE } from "@haccp/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import {
  ForbiddenError,
  ValidationError,
} from "../../core/errors/app-errors.js";

const employeeRepository = vi.hoisted(() => ({
  findDetailById: vi.fn(),
  updateByIdAndOrganization: vi.fn(),
  replaceLocationAssignments: vi.fn(),
}));
const membershipCache = vi.hoisted(() => ({ invalidate: vi.fn() }));
const changeActiveEmployeeRole = vi.hoisted(() => vi.fn());
const userService = vi.hoisted(() => ({ updateProfile: vi.fn() }));
const issueMembershipInvitation = vi.hoisted(() => vi.fn());

vi.mock("./employee.repository.js", () => ({ employeeRepository }));
vi.mock("./membership-cache.js", () => ({ membershipCache }));
vi.mock("./employee.role.js", () => ({ changeActiveEmployeeRole }));
vi.mock("../users/user.service.js", () => ({ userService }));
vi.mock("./employee.invitations.js", () => ({ issueMembershipInvitation }));

const { employeeService } = await import("./employee.service.js");

const ORGANIZATION_ID = "00000000-0000-4000-8000-0000000000o1";
const MEMBERSHIP_ID = "00000000-0000-4000-8000-0000000000m1";
const OTHER_USER_ID = "00000000-0000-4000-8000-0000000000u1";
const ACTOR_USER_ID = "00000000-0000-4000-8000-0000000000u2";
const CLERK_ORG_ID = "org_test";
const CLERK_USER_ID = "user_test";
const LOCATION_ID = "00000000-0000-4000-8000-0000000000l1";

const tenantLocations = [
  {
    id: LOCATION_ID,
    organizationId: ORGANIZATION_ID,
    name: "Main",
    isDefault: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

function membershipRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: MEMBERSHIP_ID,
    organizationId: ORGANIZATION_ID,
    userId: OTHER_USER_ID,
    role: ORG_ROLE.EMPLOYEE,
    status: MEMBERSHIP_STATUS.ACTIVE,
    clerkInvitationId: null,
    invitedAt: null,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function userRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: OTHER_USER_ID,
    clerkUserId: CLERK_USER_ID,
    firstName: "Emil",
    lastName: "Employee",
    email: "emil@example.test",
    imageUrl: "",
    hasImage: false,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function detail(overrides: {
  membership?: Partial<Record<string, unknown>>;
  user?: Partial<Record<string, unknown>>;
  locationIds?: string[];
} = {}) {
  return {
    membership: membershipRow(overrides.membership),
    user: userRow(overrides.user),
    locationIds: overrides.locationIds ?? [LOCATION_ID],
  };
}

const db = {
  transaction: async (fn: (tx: unknown) => unknown) => fn(db),
} as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("employeeService.updateRole", () => {
  it("rejects a target that is not active", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { status: MEMBERSHIP_STATUS.DRAFT } }),
    );

    await expect(
      employeeService.updateRole(
        db,
        ORGANIZATION_ID,
        CLERK_ORG_ID,
        ACTOR_USER_ID,
        MEMBERSHIP_ID,
        { role: ORG_ROLE.ADMIN },
        tenantLocations,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(changeActiveEmployeeRole).not.toHaveBeenCalled();
  });

  it("is a no-op — even targeting yourself — when the role does not actually change", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { userId: ACTOR_USER_ID, role: ORG_ROLE.EMPLOYEE } }),
    );

    const result = await employeeService.updateRole(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      ACTOR_USER_ID,
      MEMBERSHIP_ID,
      { role: ORG_ROLE.EMPLOYEE },
      tenantLocations,
    );

    expect(result.role).toBe(ORG_ROLE.EMPLOYEE);
    expect(changeActiveEmployeeRole).not.toHaveBeenCalled();
  });

  it("rejects an actual self-role-change", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { userId: ACTOR_USER_ID, role: ORG_ROLE.EMPLOYEE } }),
    );

    await expect(
      employeeService.updateRole(
        db,
        ORGANIZATION_ID,
        CLERK_ORG_ID,
        ACTOR_USER_ID,
        MEMBERSHIP_ID,
        { role: ORG_ROLE.ADMIN },
        tenantLocations,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);

    expect(changeActiveEmployeeRole).not.toHaveBeenCalled();
  });

  it("delegates a genuine change on someone else to the Clerk-first primitive", async () => {
    employeeRepository.findDetailById.mockResolvedValue(detail());
    changeActiveEmployeeRole.mockResolvedValue(
      membershipRow({ role: ORG_ROLE.ADMIN }),
    );

    const result = await employeeService.updateRole(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      ACTOR_USER_ID,
      MEMBERSHIP_ID,
      { role: ORG_ROLE.ADMIN },
      tenantLocations,
    );

    expect(changeActiveEmployeeRole).toHaveBeenCalledWith(db, {
      organizationId: ORGANIZATION_ID,
      clerkOrgId: CLERK_ORG_ID,
      clerkUserId: CLERK_USER_ID,
      membershipId: MEMBERSHIP_ID,
      role: ORG_ROLE.ADMIN,
    });
    expect(result.role).toBe(ORG_ROLE.ADMIN);
  });
});

describe("employeeService.updateLocations", () => {
  it("rejects a location outside the tenant", async () => {
    employeeRepository.findDetailById.mockResolvedValue(detail());

    await expect(
      employeeService.updateLocations(
        db,
        ORGANIZATION_ID,
        CLERK_ORG_ID,
        MEMBERSHIP_ID,
        { locationIds: ["00000000-0000-4000-8000-00000000fff1"] },
        tenantLocations,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(employeeRepository.replaceLocationAssignments).not.toHaveBeenCalled();
  });

  it("rejects an empty array for a role that requires location assignments", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { role: ORG_ROLE.EMPLOYEE } }),
    );

    await expect(
      employeeService.updateLocations(
        db,
        ORGANIZATION_ID,
        CLERK_ORG_ID,
        MEMBERSHIP_ID,
        { locationIds: [] },
        tenantLocations,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(employeeRepository.replaceLocationAssignments).not.toHaveBeenCalled();
  });

  it("allows an empty array for an admin", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { role: ORG_ROLE.ADMIN }, locationIds: [] }),
    );

    const result = await employeeService.updateLocations(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      MEMBERSHIP_ID,
      { locationIds: [] },
      tenantLocations,
    );

    expect(result.locationIds).toEqual([]);
  });

  it("is a no-op when the submitted set matches the current one", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ locationIds: [LOCATION_ID] }),
    );

    await employeeService.updateLocations(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      MEMBERSHIP_ID,
      { locationIds: [LOCATION_ID] },
      tenantLocations,
    );

    expect(employeeRepository.replaceLocationAssignments).not.toHaveBeenCalled();
    expect(membershipCache.invalidate).not.toHaveBeenCalled();
  });

  it("replaces assignments transactionally and invalidates the cache on a real change", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ locationIds: [] }),
    );

    const result = await employeeService.updateLocations(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      MEMBERSHIP_ID,
      { locationIds: [LOCATION_ID] },
      tenantLocations,
    );

    expect(employeeRepository.replaceLocationAssignments).toHaveBeenCalledWith(
      db,
      MEMBERSHIP_ID,
      ORGANIZATION_ID,
      [LOCATION_ID],
    );
    expect(membershipCache.invalidate).toHaveBeenCalledWith(
      CLERK_ORG_ID,
      CLERK_USER_ID,
    );
    expect(result.locationIds).toEqual([LOCATION_ID]);
  });
});

describe("employeeService.updateProfile", () => {
  it("rejects a target that is active", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { status: MEMBERSHIP_STATUS.ACTIVE } }),
    );

    await expect(
      employeeService.updateProfile(
        db,
        ORGANIZATION_ID,
        CLERK_ORG_ID,
        ACTOR_USER_ID,
        "en",
        ACTOR_USER_ID,
        MEMBERSHIP_ID,
        { firstName: "New" },
        tenantLocations,
      ),
    ).rejects.toBeInstanceOf(ValidationError);

    expect(userService.updateProfile).not.toHaveBeenCalled();
  });

  it("is a no-op when nothing actually differs", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { status: MEMBERSHIP_STATUS.DRAFT } }),
    );

    await employeeService.updateProfile(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      ACTOR_USER_ID,
      "en",
      ACTOR_USER_ID,
      MEMBERSHIP_ID,
      { firstName: "Emil", role: ORG_ROLE.EMPLOYEE },
      tenantLocations,
    );

    expect(userService.updateProfile).not.toHaveBeenCalled();
    expect(issueMembershipInvitation).not.toHaveBeenCalled();
  });

  it("rejects an actual self-role-change", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({
        membership: { status: MEMBERSHIP_STATUS.DRAFT, userId: ACTOR_USER_ID },
      }),
    );

    await expect(
      employeeService.updateProfile(
        db,
        ORGANIZATION_ID,
        CLERK_ORG_ID,
        ACTOR_USER_ID,
        "en",
        ACTOR_USER_ID,
        MEMBERSHIP_ID,
        { role: ORG_ROLE.ADMIN },
        tenantLocations,
      ),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("writes a plain update for a draft employee, with no Clerk reissue", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({ membership: { status: MEMBERSHIP_STATUS.DRAFT } }),
    );
    userService.updateProfile.mockResolvedValue(userRow({ firstName: "Nova" }));

    const result = await employeeService.updateProfile(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      ACTOR_USER_ID,
      "en",
      ACTOR_USER_ID,
      MEMBERSHIP_ID,
      { firstName: "Nova" },
      tenantLocations,
    );

    expect(userService.updateProfile).toHaveBeenCalledWith(db, OTHER_USER_ID, {
      email: undefined,
      firstName: "Nova",
      lastName: undefined,
    });
    expect(issueMembershipInvitation).not.toHaveBeenCalled();
    expect(result.firstName).toBe("Nova");
  });

  it("reissues the Clerk invitation when a changed field affects an invited employee", async () => {
    employeeRepository.findDetailById.mockResolvedValue(
      detail({
        membership: {
          status: MEMBERSHIP_STATUS.INVITED,
          clerkInvitationId: "inv_123",
        },
      }),
    );
    employeeRepository.updateByIdAndOrganization.mockResolvedValue(
      membershipRow({
        status: MEMBERSHIP_STATUS.INVITED,
        clerkInvitationId: "inv_123",
        role: ORG_ROLE.ADMIN,
      }),
    );
    issueMembershipInvitation.mockResolvedValue(
      membershipRow({
        status: MEMBERSHIP_STATUS.INVITED,
        clerkInvitationId: "inv_456",
        role: ORG_ROLE.ADMIN,
      }),
    );

    const result = await employeeService.updateProfile(
      db,
      ORGANIZATION_ID,
      CLERK_ORG_ID,
      ACTOR_USER_ID,
      "en",
      ACTOR_USER_ID,
      MEMBERSHIP_ID,
      { role: ORG_ROLE.ADMIN },
      tenantLocations,
    );

    expect(issueMembershipInvitation).toHaveBeenCalledWith(
      db,
      ORGANIZATION_ID,
      MEMBERSHIP_ID,
      expect.objectContaining({ clerkOrgId: CLERK_ORG_ID, role: ORG_ROLE.ADMIN }),
      { previousInvitationId: "inv_123" },
    );
    expect(result.role).toBe(ORG_ROLE.ADMIN);
  });
});
