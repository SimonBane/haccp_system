import type {
  CreateEmployeeInput,
  EmployeeListResponse,
  EmployeeResponse,
  LocationResponse,
  UpdateEmployeeInput,
  UpdateEmployeeLocationsInput,
  UpdateEmployeeRoleInput,
} from "@haccp/shared";
import { normalizeEmail, normalizeOrgRole, ORG_ROLE } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { env } from "../../env.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { Organization } from "../../core/db/schema/organizations.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import {
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { logger } from "../../lib/logger.js";
import { locationRepository } from "../locations/location.repository.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import { userService } from "../users/user.service.js";
import { userRepository } from "../users/user.repository.js";
import { mapLocationResponses, mapLocations, toEmployeeResponse } from "./employee.mapper.js";
import { membershipLocationsCache } from "./membership-locations-cache.js";
import {
  employeeRepository,
  type MembershipWithUserRow,
} from "./employee.repository.js";

type LinkMembershipRow = {
  membership: OrganizationMembership;
  user: User;
};

type EmployeeDetail = NonNullable<
  Awaited<ReturnType<typeof employeeRepository.findDetailById>>
>;

function buildEmployeeResponseFromDetail(
  detail: EmployeeDetail,
  allLocations: LocationResponse[],
  overrides?: {
    membership?: Partial<EmployeeDetail["membership"]>;
    user?: Partial<EmployeeDetail["user"]>;
    locationIds?: string[];
  },
): EmployeeResponse {
  return toEmployeeResponse({
    membership: { ...detail.membership, ...overrides?.membership },
    user: { ...detail.user, ...overrides?.user },
    locationIds: overrides?.locationIds ?? detail.locationIds,
    locations: mapLocationResponses(
      allLocations,
      overrides?.locationIds ?? detail.locationIds,
    ),
  });
}

function assertLocationIdsInTenant(
  locationIds: string[],
  tenantLocations: LocationResponse[],
): void {
  const validIds = new Set(tenantLocations.map((location) => location.id));

  if (!locationIds.every((locationId) => validIds.has(locationId))) {
    throw new ValidationError("One or more locations are invalid");
  }
}

async function sendClerkInvitation(
  clerkOrgId: string,
  inviterUserId: string,
  email: string,
  role: string,
) {
  try {
    return await clerkClient.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      inviterUserId,
      emailAddress: email,
      role: normalizeOrgRole(role),
      redirectUrl: `${env.WEB_APP_URL}/accept-invitation`,
    });
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "clerkError" in error &&
      Array.isArray((error as { errors?: unknown[] }).errors)
    ) {
      const clerkErrors = (error as unknown as {
        errors: Array<{
          meta?: { paramName?: string };
          longMessage?: string;
        }>;
      }).errors;
      const roleError = clerkErrors.find(
        (entry) => entry.meta?.paramName === "role",
      );

      if (roleError) {
        throw new ValidationError(
          roleError.longMessage ?? "The selected organization role is not available",
        );
      }
    }

    throw error;
  }
}

async function invalidateMembershipLocationsCache(
  organizationId: string,
  userId: string,
): Promise<void> {
  await membershipLocationsCache.invalidate(organizationId, userId);
}

async function ensureMembershipHasLocations(
  db: Db,
  organizationId: string,
  membershipId: string,
): Promise<void> {
  const existing = await employeeRepository.getLocationIdsForMembership(
    db,
    membershipId,
  );

  if (existing.length > 0) {
    return;
  }

  const defaultLocation = await locationRepository.findDefaultByOrganizationId(
    db,
    organizationId,
  );

  if (!defaultLocation) {
    throw new InternalError("Organization has no default location");
  }

  await employeeRepository.replaceLocationAssignments(db, membershipId, [
    defaultLocation.id,
  ]);
}

type ClerkLinkProfile = {
  firstName: string;
  lastName: string;
  email: string;
  imageUrl: string;
  hasImage: boolean;
};

async function activateMembership(
  db: Db,
  organizationId: string,
  membershipId: string,
  userId: string,
  updates: {
    role: string;
    clerkInvitationId?: string | null;
    invitedAt?: Date | null;
  },
): Promise<void> {
  await employeeRepository.updateById(db, membershipId, {
    userId,
    role: updates.role,
    status: MEMBERSHIP_STATUS.ACTIVE,
    clerkInvitationId: updates.clerkInvitationId,
    invitedAt: updates.invitedAt ?? new Date(),
  });

  await ensureMembershipHasLocations(db, organizationId, membershipId);
  await invalidateMembershipLocationsCache(organizationId, userId);
}

export const employeeService = {
  async list(db: Db, organizationId: string): Promise<EmployeeListResponse> {
    const [rows, allLocations] = await Promise.all([
      employeeRepository.findManyWithUsersByOrganizationId(db, organizationId),
      locationRepository.findByOrganizationId(db, organizationId),
    ]);

    const items = rows.map((row) =>
      toEmployeeResponse({
        membership: row.membership,
        user: row.user,
        locationIds: row.locationIds,
        locations: mapLocations(allLocations, row.locationIds),
      }),
    );

    return { items };
  },

  async create(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterUserId: string,
    input: CreateEmployeeInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const email = normalizeEmail(input.email);
    const existing = await employeeRepository.findByEmailIncludingDeleted(
      db,
      organizationId,
      email,
    );

    if (existing && !existing.membership.deletedAt) {
      throw new ConflictError("An employee with this email already exists");
    }

    assertLocationIdsInTenant(input.locationIds, tenantLocations);

    const role = normalizeOrgRole(input.role);

    const created = await db.transaction(async (tx) => {
      let user: User | null | undefined = existing?.user;

      if (existing?.membership.deletedAt) {
        user = await userService.updateProfile(tx, existing.user.id, {
          email,
          firstName: input.firstName,
          lastName: input.lastName,
        });

        if (!user) {
          throw new ValidationError("Failed to restore employee user");
        }
      } else if (!user) {
        user = await userService.createDraftUser(tx, {
          email,
          firstName: input.firstName,
          lastName: input.lastName,
        });

        if (!user) {
          throw new ValidationError("Failed to create employee user");
        }
      }

      const employee =
        existing?.membership.deletedAt
          ? await employeeRepository.updateById(tx, existing.membership.id, {
              userId: user.id,
              role,
              status: MEMBERSHIP_STATUS.DRAFT,
              clerkInvitationId: null,
              invitedAt: null,
              deletedAt: null,
            })
          : await employeeRepository.insert(tx, {
              organizationId,
              userId: user.id,
              role,
              status: MEMBERSHIP_STATUS.DRAFT,
            });

      if (!employee) {
        throw new ValidationError("Failed to create employee");
      }

      await employeeRepository.replaceLocationAssignments(
        tx,
        employee.id,
        input.locationIds,
      );

      return { employee, user, email, role };
    });

    let membership = created.employee;

    if (input.inviteNow) {
      const invitation = await sendClerkInvitation(
        clerkOrgId,
        inviterUserId,
        created.email,
        created.role,
      );

      const invited = await employeeRepository.updateById(db, membership.id, {
        status: MEMBERSHIP_STATUS.INVITED,
        clerkInvitationId: invitation.id,
        invitedAt: new Date(),
      });

      membership = invited ?? membership;
    }

    await invalidateMembershipLocationsCache(organizationId, membership.userId);

    return buildEmployeeResponseFromDetail(
      {
        membership,
        user: created.user,
        locationIds: input.locationIds,
      },
      tenantLocations,
    );
  },

  async update(
    db: Db,
    organizationId: string,
    membershipId: string,
    input: UpdateEmployeeInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    if (detail.membership.status === MEMBERSHIP_STATUS.ACTIVE) {
      throw new ValidationError("Active employees cannot be edited this way");
    }

    let updatedUser = detail.user;

    if (input.email) {
      const email = normalizeEmail(input.email);
      const existing = await employeeRepository.findByEmail(
        db,
        organizationId,
        email,
      );

      if (existing && existing.membership.id !== membershipId) {
        throw new ConflictError("An employee with this email already exists");
      }
    }

    if (
      input.email !== undefined ||
      input.firstName !== undefined ||
      input.lastName !== undefined
    ) {
      const user = await userService.updateProfile(db, detail.user.id, {
        email: input.email ? normalizeEmail(input.email) : undefined,
        firstName: input.firstName,
        lastName: input.lastName,
      });

      if (user) {
        updatedUser = user;
      }
    }

    let updatedMembership = detail.membership;

    if (input.role) {
      const membership = await employeeRepository.updateById(db, membershipId, {
        role: normalizeOrgRole(input.role),
      });

      if (membership) {
        updatedMembership = membership;
      }
    }

    return buildEmployeeResponseFromDetail(
      detail,
      tenantLocations,
      {
        membership: updatedMembership,
        user: updatedUser,
      },
    );
  },

  async invite(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterUserId: string,
    membershipId: string,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    if (detail.membership.status !== MEMBERSHIP_STATUS.DRAFT) {
      throw new ValidationError("Only draft employees can be invited");
    }

    const invitation = await sendClerkInvitation(
      clerkOrgId,
      inviterUserId,
      detail.user.email,
      detail.membership.role,
    );

    const updatedMembership = await employeeRepository.updateById(
      db,
      membershipId,
      {
        status: MEMBERSHIP_STATUS.INVITED,
        clerkInvitationId: invitation.id,
        invitedAt: new Date(),
      },
    );

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership: updatedMembership ?? detail.membership,
    });
  },

  async revokeInvitation(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    if (
      detail.membership.status !== MEMBERSHIP_STATUS.INVITED ||
      !detail.membership.clerkInvitationId
    ) {
      throw new ValidationError("Employee does not have a pending invitation");
    }

    await clerkClient.organizations.revokeOrganizationInvitation({
      organizationId: clerkOrgId,
      invitationId: detail.membership.clerkInvitationId,
    });

    const updatedMembership = await employeeRepository.updateById(
      db,
      membershipId,
      {
        status: MEMBERSHIP_STATUS.DRAFT,
        clerkInvitationId: null,
        invitedAt: null,
      },
    );

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership: updatedMembership ?? detail.membership,
    });
  },

  async updateRole(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
    input: UpdateEmployeeRoleInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    const role = normalizeOrgRole(input.role);

    if (
      detail.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
      detail.user.clerkUserId
    ) {
      await clerkClient.organizations.updateOrganizationMembership({
        organizationId: clerkOrgId,
        userId: detail.user.clerkUserId,
        role,
      });
    }

    const updatedMembership = await employeeRepository.updateById(
      db,
      membershipId,
      { role },
    );

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      membership: updatedMembership ?? detail.membership,
    });
  },

  async updateLocations(
    db: Db,
    organizationId: string,
    membershipId: string,
    input: UpdateEmployeeLocationsInput,
    tenantLocations: LocationResponse[],
  ): Promise<EmployeeResponse> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    assertLocationIdsInTenant(input.locationIds, tenantLocations);

    await employeeRepository.replaceLocationAssignments(
      db,
      membershipId,
      input.locationIds,
    );

    await invalidateMembershipLocationsCache(
      organizationId,
      detail.membership.userId,
    );

    return buildEmployeeResponseFromDetail(detail, tenantLocations, {
      locationIds: input.locationIds,
    });
  },

  async remove(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
  ): Promise<void> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    if (
      detail.membership.status === MEMBERSHIP_STATUS.INVITED &&
      detail.membership.clerkInvitationId
    ) {
      await clerkClient.organizations.revokeOrganizationInvitation({
        organizationId: clerkOrgId,
        invitationId: detail.membership.clerkInvitationId,
      });
    }

    if (
      detail.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
      detail.user.clerkUserId
    ) {
      await clerkClient.organizations.deleteOrganizationMembership({
        organizationId: clerkOrgId,
        userId: detail.user.clerkUserId,
      });
    }

    await employeeRepository.softDeleteById(db, membershipId);
    await invalidateMembershipLocationsCache(
      organizationId,
      detail.membership.userId,
    );
  },

  async getAssignedLocationIdsForUser(
    db: Db,
    organizationId: string,
    userDbId: string,
  ): Promise<string[]> {
    const cached = await membershipLocationsCache.get(organizationId, userDbId);

    if (cached) {
      return cached;
    }

    const locationIds = await employeeRepository.getAssignedLocationIdsForUser(
      db,
      organizationId,
      userDbId,
    );

    await membershipLocationsCache.set(organizationId, userDbId, locationIds);

    return locationIds;
  },
};

export const membershipWebhookService = {
  async linkMembershipFromClerk(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    email: string,
    role: string,
    clerkInvitationId?: string | null,
    profile?: ClerkLinkProfile,
    options?: {
      organization?: Organization;
      membershipRow?: LinkMembershipRow | MembershipWithUserRow | null;
    },
  ) {
    const organization =
      options?.organization ??
      (await organizationRepository.findByClerkOrgId(db, clerkOrgId));

    if (!organization) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeOrgRole(role);
    const membershipRow =
      options?.membershipRow !== undefined
        ? options.membershipRow
        : ((clerkInvitationId
            ? await employeeRepository.findByInvitationId(db, clerkInvitationId)
            : null) ??
          (await employeeRepository.findByEmail(
            db,
            organization.id,
            normalizedEmail,
          )));

    const clerkProfile = profile ?? {
      firstName: "",
      lastName: "",
      email: normalizedEmail,
      imageUrl: "",
      hasImage: false,
    };

    if (membershipRow) {
      if (
        membershipRow.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
        membershipRow.user.clerkUserId === clerkUserId
      ) {
        return;
      }

      let linkedUserId: string;
      const existingClerkUser = await userRepository.findByClerkUserId(
        db,
        clerkUserId,
      );

      if (
        existingClerkUser &&
        existingClerkUser.id !== membershipRow.user.id
      ) {
        linkedUserId = existingClerkUser.id;
      } else if (membershipRow.user.clerkUserId) {
        const user = await userService.syncUserFromClerk(
          db,
          clerkUserId,
          clerkProfile,
        );

        if (!user) {
          return;
        }

        linkedUserId = user.id;
      } else {
        const user = await userService.linkClerkProfileToDraftUser(
          db,
          membershipRow.user.id,
          clerkUserId,
          clerkProfile,
        );

        if (!user) {
          return;
        }

        linkedUserId = user.id;
      }

      await activateMembership(
        db,
        organization.id,
        membershipRow.membership.id,
        linkedUserId,
        {
          role: normalizedRole,
          clerkInvitationId:
            clerkInvitationId ?? membershipRow.membership.clerkInvitationId,
          invitedAt: membershipRow.membership.invitedAt,
        },
      );
      return;
    }

    if (normalizedRole !== ORG_ROLE.ADMIN) {
      logger.warn(
        { clerkOrgId, email: normalizedEmail, role: normalizedRole },
        "Ignoring Clerk invitation without local draft for non-admin user",
      );
      return;
    }

    const user = await userService.syncUserFromClerk(
      db,
      clerkUserId,
      clerkProfile,
    );

    if (!user) {
      return;
    }

    const membership = await employeeRepository.insert(db, {
      organizationId: organization.id,
      userId: user.id,
      role: normalizedRole,
      status: MEMBERSHIP_STATUS.ACTIVE,
      clerkInvitationId: clerkInvitationId ?? null,
      invitedAt: new Date(),
    });

    if (!membership) {
      return;
    }

    await ensureMembershipHasLocations(db, organization.id, membership.id);
    await invalidateMembershipLocationsCache(organization.id, user.id);
  },

  async removeMembership(db: Db, clerkOrgId: string, clerkUserId: string) {
    const row = await employeeRepository.findMembershipByClerkIds(
      db,
      clerkOrgId,
      clerkUserId,
    );

    if (!row) {
      return;
    }

    await employeeRepository.softDeleteById(db, row.membership.id);
    await membershipLocationsCache.invalidate(row.organizationId, row.userId);
  },

  async handleInvitationRevoked(db: Db, clerkInvitationId: string) {
    await employeeRepository.revertInvitationById(db, clerkInvitationId);
  },
};
