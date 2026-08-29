import type {
  AppLocale,
  CreateEmployeeInput,
  EmployeeListResponse,
  EmployeeResponse,
  LocationResponse,
  UpdateEmployeeLocationsInput,
  UpdateEmployeeProfileInput,
  UpdateEmployeeRoleInput,
} from "@haccp/shared";
import {
  API_ERROR_CODE,
  normalizeEmail,
  normalizeName,
  normalizeOrgRole,
  requiresLocationAssignments,
} from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { userService } from "../users/user.service.js";
import {
  revokeClerkInvitation,
  syncClerkMembershipRemoval,
} from "./employee.clerk.js";
import { changeActiveEmployeeRole } from "./employee.role.js";
import type { EmployeeDetail } from "./employee.mapper.js";
import {
  buildEmployeeResponseFromDetail,
  mapLocationResponses,
  toEmployeeResponse,
} from "./employee.mapper.js";
import { issueMembershipInvitation } from "./employee.invitations.js";
import {
  resolveLocationAssignments,
  sameLocationIds,
} from "./employee.locations.js";
import { membershipCache } from "./membership-cache.js";
import { employeeRepository } from "./employee.repository.js";

async function requireEmployeeDetail(
  db: Db,
  organizationId: string,
  membershipId: string,
): Promise<EmployeeDetail> {
  const detail = await employeeRepository.findDetailById(
    db,
    organizationId,
    membershipId,
  );

  if (!detail) {
    throw new NotFoundError("Employee not found");
  }

  return detail;
}

function assertLocationIdsBelongToTenant(
  locationIds: string[],
  tenantLocations: LocationResponse[],
): void {
  const tenantLocationIds = new Set(
    tenantLocations.map((location) => location.id),
  );
  const hasInvalidLocation = locationIds.some(
    (locationId) => !tenantLocationIds.has(locationId),
  );

  if (hasInvalidLocation) {
    throw new ValidationError("One or more locations are invalid");
  }
}

async function createDraftEmployee(
  db: Db,
  organizationId: string,
  input: CreateEmployeeInput,
  tenantLocations: LocationResponse[],
): Promise<{
  membership: OrganizationMembership;
  user: User;
  locationIds: string[];
}> {
  const role = normalizeOrgRole(input.role);
  const locationIds = resolveLocationAssignments(
    role,
    input.locationIds,
    tenantLocations,
  );

  try {
    return await db.transaction(async (tx) => {
      const user = await userService.ensureDraftUser(tx, {
        email: normalizeEmail(input.email),
        firstName: input.firstName,
        lastName: input.lastName,
      });

      if (!user) {
        throw new ValidationError("Failed to create employee user");
      }

      const membership = await employeeRepository.insert(tx, {
        organizationId,
        userId: user.id,
        role,
        status: MEMBERSHIP_STATUS.DRAFT,
      });

      if (!membership) {
        throw new ValidationError("Failed to create employee");
      }

      await employeeRepository.replaceLocationAssignments(
        tx,
        membership.id,
        organizationId,
        locationIds,
      );

      return { membership, user, locationIds };
    });
  } catch (error) {
    mapDbMutationError(error, {
      unique: () =>
        new ConflictError("An employee with this email already exists", {
          code: API_ERROR_CODE.EMPLOYEE_EMAIL_EXISTS,
        }),
      foreignKey: () =>
        new ValidationError("One or more locations are invalid"),
    });
  }
}

export const employeeService = {
  async list(
    db: Db,
    organizationId: string,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeListResponse> {
    const rows = await employeeRepository.findManyWithUsersByOrganizationId(
      db,
      organizationId,
    );

    const items = rows.map((row) =>
      toEmployeeResponse({
        membership: row.membership,
        user: row.user,
        locationIds: row.locationIds,
        locations: mapLocationResponses(tenantLocations, row.locationIds),
      }),
    );

    return { items };
  },

  async create(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterUserId: string,
    orgLocale: AppLocale,
    input: CreateEmployeeInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    assertLocationIdsBelongToTenant(input.locationIds, tenantLocations);

    const {
      membership: draft,
      user,
      locationIds,
    } = await createDraftEmployee(db, organizationId, input, tenantLocations);

    const membership = input.inviteNow
      ? await issueMembershipInvitation(db, organizationId, draft.id, {
          locale: orgLocale,
          clerkOrgId,
          inviterUserId,
          email: user.email,
          role: draft.role,
          firstName: user.firstName,
          lastName: user.lastName,
        })
      : draft;

    await membershipCache.invalidate(clerkOrgId, user.clerkUserId);

    return buildEmployeeResponseFromDetail(
      { membership, user, locationIds },
      tenantLocations,
    );
  },

  async updateRole(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    actorUserDbId: string,
    membershipId: string,
    input: UpdateEmployeeRoleInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(
      db,
      organizationId,
      membershipId,
    );

    if (detail.membership.status !== MEMBERSHIP_STATUS.ACTIVE) {
      throw new ValidationError(
        "Only active employees can be updated through this endpoint",
      );
    }

    const role = normalizeOrgRole(input.role);

    if (role === normalizeOrgRole(detail.membership.role)) {
      return buildEmployeeResponseFromDetail(detail, tenantLocations);
    }

    if (detail.membership.userId === actorUserDbId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    // ACTIVE always has a clerkUserId (set when the invitation is accepted).
    const membership = await changeActiveEmployeeRole(db, {
      organizationId,
      clerkOrgId,
      clerkUserId: detail.user.clerkUserId as string,
      membershipId: detail.membership.id,
      role,
    });

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership,
    });
  },

  async updateLocations(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
    input: UpdateEmployeeLocationsInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(
      db,
      organizationId,
      membershipId,
    );
    assertLocationIdsBelongToTenant(input.locationIds, tenantLocations);

    if (
      requiresLocationAssignments(detail.membership.role) &&
      input.locationIds.length === 0
    ) {
      throw new ValidationError("Select at least one location.");
    }

    if (sameLocationIds(detail.locationIds, input.locationIds)) {
      return buildEmployeeResponseFromDetail(detail, tenantLocations);
    }

    await db.transaction(async (tx) => {
      await employeeRepository.replaceLocationAssignments(
        tx,
        membershipId,
        organizationId,
        input.locationIds,
      );
    });

    await membershipCache.invalidate(clerkOrgId, detail.user.clerkUserId);

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      locationIds: input.locationIds,
    });
  },

  async updateProfile(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterUserId: string,
    orgLocale: AppLocale,
    actorUserDbId: string,
    membershipId: string,
    input: UpdateEmployeeProfileInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(
      db,
      organizationId,
      membershipId,
    );

    if (detail.membership.status === MEMBERSHIP_STATUS.ACTIVE) {
      throw new ValidationError(
        "Only draft or invited employees can be updated through this endpoint",
      );
    }

    const email =
      input.email !== undefined ? normalizeEmail(input.email) : undefined;
    const firstName =
      input.firstName !== undefined
        ? normalizeName(input.firstName)
        : undefined;
    const lastName =
      input.lastName !== undefined ? normalizeName(input.lastName) : undefined;
    const role =
      input.role !== undefined ? normalizeOrgRole(input.role) : undefined;

    const emailChanged =
      email !== undefined && email !== normalizeEmail(detail.user.email);
    const firstNameChanged =
      firstName !== undefined &&
      firstName !== normalizeName(detail.user.firstName);
    const lastNameChanged =
      lastName !== undefined &&
      lastName !== normalizeName(detail.user.lastName);
    const roleChanged =
      role !== undefined && role !== normalizeOrgRole(detail.membership.role);

    if (
      !emailChanged &&
      !firstNameChanged &&
      !lastNameChanged &&
      !roleChanged
    ) {
      return buildEmployeeResponseFromDetail(detail, tenantLocations);
    }

    if (roleChanged && detail.membership.userId === actorUserDbId) {
      throw new ForbiddenError("You cannot change your own role");
    }

    let next: EmployeeDetail;

    try {
      next = await db.transaction(async (tx) => {
        const user =
          emailChanged || firstNameChanged || lastNameChanged
            ? await userService.updateProfile(tx, detail.user.id, {
                email,
                firstName,
                lastName,
              })
            : null;

        const membership = roleChanged
          ? await employeeRepository.updateByIdAndOrganization(
              tx,
              organizationId,
              membershipId,
              { role },
            )
          : null;

        return {
          user: user ?? detail.user,
          membership: membership ?? detail.membership,
          locationIds: detail.locationIds,
        };
      });
    } catch (error) {
      mapDbMutationError(error, {
        unique: () =>
          new ConflictError("An employee with this email already exists", {
            code: API_ERROR_CODE.EMPLOYEE_EMAIL_EXISTS,
          }),
      });
    }

    let membership = next.membership;

    if (
      detail.membership.status === MEMBERSHIP_STATUS.INVITED &&
      detail.membership.clerkInvitationId
    ) {
      membership = await issueMembershipInvitation(
        db,
        organizationId,
        membershipId,
        {
          locale: orgLocale,
          clerkOrgId,
          inviterUserId,
          email: next.user.email,
          role: next.membership.role,
          firstName: next.user.firstName,
          lastName: next.user.lastName,
        },
        { previousInvitationId: detail.membership.clerkInvitationId },
      );
    }

    // No-op if clerkUserId is null (draft/pre-invitation employees have none yet).
    await membershipCache.invalidate(clerkOrgId, detail.user.clerkUserId);

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership,
      user: next.user,
      locationIds: next.locationIds,
    });
  },

  async invite(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterUserId: string,
    orgLocale: AppLocale,
    membershipId: string,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(
      db,
      organizationId,
      membershipId,
    );

    if (detail.membership.status !== MEMBERSHIP_STATUS.DRAFT) {
      throw new ValidationError("Only draft employees can be invited");
    }

    const membership = await issueMembershipInvitation(
      db,
      organizationId,
      membershipId,
      {
        locale: orgLocale,
        clerkOrgId,
        inviterUserId,
        email: detail.user.email,
        role: detail.membership.role,
        firstName: detail.user.firstName,
        lastName: detail.user.lastName,
      },
    );

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership,
    });
  },

  async revokeInvitation(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(
      db,
      organizationId,
      membershipId,
    );

    if (
      detail.membership.status !== MEMBERSHIP_STATUS.INVITED ||
      !detail.membership.clerkInvitationId
    ) {
      throw new ValidationError("Employee does not have a pending invitation");
    }

    await revokeClerkInvitation(
      clerkOrgId,
      detail.membership.clerkInvitationId,
    );

    const membership = await employeeRepository.updateStatusByIdAndOrganization(
      db,
      organizationId,
      membershipId,
      MEMBERSHIP_STATUS.INVITED,
      {
        status: MEMBERSHIP_STATUS.DRAFT,
        clerkInvitationId: null,
        invitedAt: null,
      },
    );

    if (!membership) {
      throw new ValidationError("Employee does not have a pending invitation");
    }

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership,
    });
  },

  async remove(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
  ): Promise<void> {
    const row = await employeeRepository.findMembershipWithUserById(
      db,
      organizationId,
      membershipId,
    );

    if (!row) {
      throw new NotFoundError("Employee not found");
    }

    await syncClerkMembershipRemoval(clerkOrgId, row);

    await employeeRepository.softDeleteByIdAndOrganization(
      db,
      organizationId,
      membershipId,
    );
    await membershipCache.invalidate(clerkOrgId, row.user.clerkUserId);
  },
};
