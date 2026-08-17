import type {
  AppLocale,
  CreateEmployeeInput,
  EmployeeListResponse,
  EmployeeResponse,
  LocationResponse,
  UpdateEmployeeInput,
} from "@haccp/shared";
import { normalizeEmail, normalizeOrgRole } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { userService } from "../users/user.service.js";
import type { EmployeeChanges } from "./employee.changes.js";
import {
  diffEmployeeChanges,
  hasProfileChanges,
  isEmptyChangeSet,
} from "./employee.changes.js";
import {
  applyActiveEmployeeProfileUpdate,
  revokeClerkInvitation,
  syncClerkMembershipRemoval,
} from "./employee.clerk.js";
import type { EmployeeDetail } from "./employee.mapper.js";
import {
  buildEmployeeResponseFromDetail,
  mapLocationResponses,
  toEmployeeResponse,
} from "./employee.mapper.js";
import { issueMembershipInvitation } from "./employee.invitations.js";
import { resolveLocationAssignments } from "./employee.locations.js";
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
  const tenantLocationIds = new Set(tenantLocations.map((location) => location.id));
  const hasInvalidLocation = locationIds.some(
    (locationId) => !tenantLocationIds.has(locationId),
  );

  if (hasInvalidLocation) {
    throw new ValidationError("One or more locations are invalid");
  }
}

function assertUpdateAllowed(
  detail: EmployeeDetail,
  input: UpdateEmployeeInput,
  changes: EmployeeChanges,
  tenantLocations: LocationResponse[],
): void {
  if (
    detail.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
    changes.email !== undefined
  ) {
    throw new ValidationError("Email cannot be changed for active employees");
  }

  if (input.locationIds !== undefined) {
    assertLocationIdsBelongToTenant(input.locationIds, tenantLocations);
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
      unique: () => new ConflictError("An employee with this email already exists"),
      foreignKey: () => new ValidationError("One or more locations are invalid"),
    });
  }
}

async function persistEmployeeChanges(
  db: Db,
  organizationId: string,
  detail: EmployeeDetail,
  changes: EmployeeChanges,
): Promise<{ user: User; locationIds: string[] }> {
  try {
    return await db.transaction(async (tx) => {
      const user = hasProfileChanges(changes)
        ? await userService.updateProfile(tx, detail.user.id, {
            email: changes.email,
            firstName: changes.firstName,
            lastName: changes.lastName,
          })
        : detail.user;

      if (!user) {
        throw new NotFoundError("Employee not found");
      }

      if (changes.locationIds) {
        await employeeRepository.replaceLocationAssignments(
          tx,
          detail.membership.id,
          organizationId,
          changes.locationIds,
        );
      }

      return {
        user,
        locationIds: changes.locationIds ?? detail.locationIds,
      };
    });
  } catch (error) {
    mapDbMutationError(error, {
      unique: () => new ConflictError("An employee with this email already exists"),
      foreignKey: () => new ValidationError("One or more locations are invalid"),
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

  async update(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterClerkUserId: string,
    orgLocale: AppLocale,
    membershipId: string,
    input: UpdateEmployeeInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await requireEmployeeDetail(db, organizationId, membershipId);
    const changes = diffEmployeeChanges(detail, input, tenantLocations);

    assertUpdateAllowed(detail, input, changes, tenantLocations);

    if (isEmptyChangeSet(changes)) {
      return buildEmployeeResponseFromDetail(detail, tenantLocations);
    }

    const next = await persistEmployeeChanges(
      db,
      organizationId,
      detail,
      changes,
    );

    try {
      if (hasProfileChanges(changes) && next.user.clerkUserId) {
        await userService.invalidateCache(next.user.clerkUserId);
      }

      const { clerkInvitationId, status } = detail.membership;

      if (status === MEMBERSHIP_STATUS.ACTIVE && detail.user.clerkUserId) {
        await applyActiveEmployeeProfileUpdate(
          detail.user.clerkUserId,
          changes,
          next.user,
        );
      }

      const membership =
        status === MEMBERSHIP_STATUS.INVITED &&
        clerkInvitationId &&
        hasProfileChanges(changes)
          ? await issueMembershipInvitation(
              db,
              organizationId,
              membershipId,
              {
                locale: orgLocale,
                clerkOrgId,
                inviterUserId: inviterClerkUserId,
                email: next.user.email,
                role: detail.membership.role,
                firstName: next.user.firstName,
                lastName: next.user.lastName,
              },
              { previousInvitationId: clerkInvitationId },
            )
          : undefined;

      return buildEmployeeResponseFromDetail(detail, tenantLocations, {
        membership,
        user: next.user,
        locationIds: next.locationIds,
      });
    } finally {
      await membershipCache.invalidate(clerkOrgId, detail.user.clerkUserId);
    }
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
    const detail = await requireEmployeeDetail(db, organizationId, membershipId);

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
    const detail = await requireEmployeeDetail(db, organizationId, membershipId);

    if (
      detail.membership.status !== MEMBERSHIP_STATUS.INVITED ||
      !detail.membership.clerkInvitationId
    ) {
      throw new ValidationError("Employee does not have a pending invitation");
    }

    await revokeClerkInvitation(clerkOrgId, detail.membership.clerkInvitationId);

    const membership =
      await employeeRepository.updateStatusByIdAndOrganization(
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

    try {
      await employeeRepository.softDeleteByIdAndOrganization(
        db,
        organizationId,
        membershipId,
      );
    } finally {
      await membershipCache.invalidate(clerkOrgId, row.user.clerkUserId);
    }
  },
};
