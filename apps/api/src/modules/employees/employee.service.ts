import type {
  CreateEmployeeInput,
  EmployeeListResponse,
  EmployeeResponse,
  UpdateEmployeeInput,
  UpdateEmployeeLocationsInput,
  UpdateEmployeeRoleInput,
} from "@haccp/shared";
import { normalizeOrgRole, ORG_ROLE } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { env } from "../../env.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
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
import { mapLocations, toEmployeeResponse } from "./employee.mapper.js";
import { membershipLocationsCache } from "./membership-locations-cache.js";
import { employeeRepository } from "./employee.repository.js";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function buildEmployeeResponse(
  db: Db,
  organizationId: string,
  membershipId: string,
): Promise<EmployeeResponse> {
  const detail = await employeeRepository.findDetailById(
    db,
    organizationId,
    membershipId,
  );

  if (!detail) {
    throw new NotFoundError("Employee not found");
  }

  const allLocations = await locationRepository.findByOrganizationId(
    db,
    organizationId,
  );

  return toEmployeeResponse({
    membership: detail.membership,
    user: detail.user,
    locationIds: detail.locationIds,
    locations: mapLocations(allLocations, detail.locationIds),
  });
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

    const locationsValid = await employeeRepository.assertLocationsBelongToOrg(
      db,
      organizationId,
      input.locationIds,
    );

    if (!locationsValid) {
      throw new ValidationError("One or more locations are invalid");
    }

    const role = normalizeOrgRole(input.role);

    const membership = await db.transaction(async (tx) => {
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

      if (input.inviteNow) {
        const invitation = await sendClerkInvitation(
          clerkOrgId,
          inviterUserId,
          email,
          role,
        );

        const invited = await employeeRepository.updateById(tx, employee.id, {
          status: MEMBERSHIP_STATUS.INVITED,
          clerkInvitationId: invitation.id,
          invitedAt: new Date(),
        });

        return invited ?? employee;
      }

      return employee;
    });

    await invalidateMembershipLocationsCache(organizationId, membership.userId);

    return buildEmployeeResponse(db, organizationId, membership.id);
  },

  async update(
    db: Db,
    organizationId: string,
    membershipId: string,
    input: UpdateEmployeeInput,
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

    await userService.updateProfile(db, detail.user.id, {
      email: input.email ? normalizeEmail(input.email) : undefined,
      firstName: input.firstName,
      lastName: input.lastName,
    });

    if (input.role) {
      await employeeRepository.updateById(db, membershipId, {
        role: normalizeOrgRole(input.role),
      });
    }

    return buildEmployeeResponse(db, organizationId, membershipId);
  },

  async invite(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    inviterUserId: string,
    membershipId: string,
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

    await employeeRepository.updateById(db, membershipId, {
      status: MEMBERSHIP_STATUS.INVITED,
      clerkInvitationId: invitation.id,
      invitedAt: new Date(),
    });

    return buildEmployeeResponse(db, organizationId, membershipId);
  },

  async revokeInvitation(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
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

    await employeeRepository.updateById(db, membershipId, {
      status: MEMBERSHIP_STATUS.DRAFT,
      clerkInvitationId: null,
      invitedAt: null,
    });

    return buildEmployeeResponse(db, organizationId, membershipId);
  },

  async updateRole(
    db: Db,
    organizationId: string,
    clerkOrgId: string,
    membershipId: string,
    input: UpdateEmployeeRoleInput,
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

    await employeeRepository.updateById(db, membershipId, {
      role,
    });

    return buildEmployeeResponse(db, organizationId, membershipId);
  },

  async updateLocations(
    db: Db,
    organizationId: string,
    membershipId: string,
    input: UpdateEmployeeLocationsInput,
  ): Promise<EmployeeResponse> {
    const detail = await employeeRepository.findDetailById(
      db,
      organizationId,
      membershipId,
    );

    if (!detail) {
      throw new NotFoundError("Employee not found");
    }

    const locationsValid = await employeeRepository.assertLocationsBelongToOrg(
      db,
      organizationId,
      input.locationIds,
    );

    if (!locationsValid) {
      throw new ValidationError("One or more locations are invalid");
    }

    await employeeRepository.replaceLocationAssignments(
      db,
      membershipId,
      input.locationIds,
    );

    await invalidateMembershipLocationsCache(
      organizationId,
      detail.membership.userId,
    );

    return buildEmployeeResponse(db, organizationId, membershipId);
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
  ) {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      return;
    }

    const normalizedEmail = normalizeEmail(email);
    const normalizedRole = normalizeOrgRole(role);
    const membershipRow =
      (clerkInvitationId
        ? await employeeRepository.findByInvitationId(db, clerkInvitationId)
        : null) ??
      (await employeeRepository.findByEmail(
        db,
        organization.id,
        normalizedEmail,
      ));

    const clerkProfile = profile ?? {
      firstName: "",
      lastName: "",
      email: normalizedEmail,
      imageUrl: "",
      hasImage: false,
    };

    if (membershipRow) {
      const existingClerkUser = await userRepository.findByClerkUserId(
        db,
        clerkUserId,
      );

      let linkedUserId: string;

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

  async removeMembership(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
  ) {
    const organization = await organizationRepository.findByClerkOrgId(
      db,
      clerkOrgId,
    );

    if (!organization) {
      return;
    }

    const user = await userRepository.findByClerkUserId(db, clerkUserId);

    if (!user) {
      return;
    }

    const membership = await employeeRepository.findByUserAndOrg(
      db,
      organization.id,
      user.id,
    );

    if (!membership) {
      return;
    }

    await employeeRepository.updateById(db, membership.id, {
      deletedAt: new Date(),
    });

    await membershipLocationsCache.invalidate(organization.id, user.id);
  },

  async handleInvitationRevoked(db: Db, clerkInvitationId: string) {
    const membershipRow = await employeeRepository.findByInvitationId(
      db,
      clerkInvitationId,
    );

    if (
      !membershipRow ||
      membershipRow.membership.status !== MEMBERSHIP_STATUS.INVITED
    ) {
      return;
    }

    await employeeRepository.updateById(db, membershipRow.membership.id, {
      status: MEMBERSHIP_STATUS.DRAFT,
      clerkInvitationId: null,
      invitedAt: null,
    });
  },
};
