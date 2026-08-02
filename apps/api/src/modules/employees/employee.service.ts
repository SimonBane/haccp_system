import type {
  CreateEmployeeInput,
  EmployeeListResponse,
  EmployeeResponse,
  LocationResponse,
  UpdateEmployeeInput,
  UpdateEmployeeLocationsInput,
  UpdateEmployeeRoleInput,
} from "@haccp/shared";
import { normalizeEmail, normalizeOrgRole } from "@haccp/shared";
import type { Db } from "../../core/db/client.js";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { env } from "../../env.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { locationRepository } from "../locations/location.repository.js";
import { userService } from "../users/user.service.js";
import { mapLocationResponses, mapLocations, toEmployeeResponse } from "./employee.mapper.js";
import { membershipLocationsCache } from "./membership-locations-cache.js";
import { employeeRepository } from "./employee.repository.js";

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

function buildInvitationRedirectUrl(firstName: string, lastName: string): string {
  const params = new URLSearchParams({ firstName, lastName });
  return `${env.WEB_APP_URL}/accept-invitation?${params.toString()}`;
}

async function sendClerkInvitation(
  clerkOrgId: string,
  inviterUserId: string,
  email: string,
  role: string,
  firstName: string,
  lastName: string,
) {
  try {
    return await clerkClient.organizations.createOrganizationInvitation({
      organizationId: clerkOrgId,
      inviterUserId,
      emailAddress: email,
      role: normalizeOrgRole(role),
      redirectUrl: buildInvitationRedirectUrl(firstName, lastName),
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
    const role = normalizeOrgRole(input.role);

    let created: { employee: OrganizationMembership; user: User; email: string; role: string };

    try {
      created = await db.transaction(async (tx) => {
        const user = await userService.ensureDraftUser(tx, {
          email,
          firstName: input.firstName,
          lastName: input.lastName,
        });

        if (!user) {
          throw new ValidationError("Failed to create employee user");
        }

        const employee = await employeeRepository.insert(tx, {
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
          organizationId,
          input.locationIds,
        );

        return { employee, user, email, role };
      });
    } catch (error) {
      mapDbMutationError(error, {
        unique: () =>
          new ConflictError("An employee with this email already exists"),
        foreignKey: () =>
          new ValidationError("One or more locations are invalid"),
      });
    }

    let membership = created.employee;

    if (input.inviteNow) {
      const invitation = await sendClerkInvitation(
        clerkOrgId,
        inviterUserId,
        created.email,
        created.role,
        created.user.firstName,
        created.user.lastName,
      );

      const invited = await employeeRepository.updateById(db, membership.id, {
        status: MEMBERSHIP_STATUS.INVITED,
        clerkInvitationId: invitation.id,
        invitedAt: new Date(),
      });

      membership = invited ?? membership;
    }

    await membershipLocationsCache.invalidate(organizationId, membership.userId);

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

    if (
      input.email !== undefined ||
      input.firstName !== undefined ||
      input.lastName !== undefined
    ) {
      try {
        const user = await userService.updateProfile(db, detail.user.id, {
          email: input.email ? normalizeEmail(input.email) : undefined,
          firstName: input.firstName,
          lastName: input.lastName,
        });

        if (user) {
          updatedUser = user;
        }
      } catch (error) {
        mapDbMutationError(error, {
          unique: () =>
            new ConflictError("An employee with this email already exists"),
        });
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
      detail.user.firstName,
      detail.user.lastName,
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

    try {
      await employeeRepository.replaceLocationAssignments(
        db,
        membershipId,
        organizationId,
        input.locationIds,
      );
    } catch (error) {
      mapDbMutationError(error, {
        foreignKey: () =>
          new ValidationError("One or more locations are invalid"),
      });
    }

    await membershipLocationsCache.invalidate(
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
    await membershipLocationsCache.invalidate(
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
