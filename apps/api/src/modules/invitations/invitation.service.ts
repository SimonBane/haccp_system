import { normalizeOrgRole } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import type { Db, DbClient } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import {
  InternalError,
  ValidationError,
} from "../../core/errors/app-errors.js";
import { mapDbMutationError } from "../../lib/db-errors.js";
import { employeeRepository } from "../employees/employee.repository.js";
import { membershipLocationsCache } from "../employees/membership-locations-cache.js";
import { tenantService } from "../tenant/tenant.service.js";
import { userService } from "../users/user.service.js";
import {
  mapClerkApiUserToProfileData,
  type ClerkProfileData,
} from "../users/user.mapper.js";

type MembershipWithUserRow = {
  membership: OrganizationMembership;
  user: User;
};

async function activateInvitedMembership(
  tx: DbClient,
  input: {
    row: MembershipWithUserRow;
    profileData: ClerkProfileData;
    orgRole: string;
  },
): Promise<string> {
  const user = await userService.linkClerkProfileToDraftUser(
    tx,
    input.row.user.id,
    input.profileData,
  );

  if (!user) {
    throw new InternalError("Failed to link invited user");
  }

  const updatedMembership = await employeeRepository.updateById(
    tx,
    input.row.membership.id,
    {
      userId: user.id,
      role: normalizeOrgRole(input.orgRole),
      status: MEMBERSHIP_STATUS.ACTIVE,
      invitedAt: input.row.membership.invitedAt ?? new Date(),
    },
  );

  if (!updatedMembership) {
    throw new InternalError("Failed to activate membership");
  }

  return user.id;
}

async function provisionNewMembership(
  tx: DbClient,
  input: {
    organizationId: string;
    profileData: ClerkProfileData;
    orgRole: string;
    defaultLocationId: string;
  },
): Promise<string> {
  const user = await userService.upsertUserFromClerk(tx, input.profileData);

  const membership = await employeeRepository.insert(tx, {
    organizationId: input.organizationId,
    userId: user.id,
    role: normalizeOrgRole(input.orgRole),
    status: MEMBERSHIP_STATUS.ACTIVE,
    invitedAt: new Date(),
  });

  if (!membership) {
    throw new InternalError("Failed to create membership");
  }

  await employeeRepository.replaceLocationAssignments(
    tx,
    membership.id,
    input.organizationId,
    [input.defaultLocationId],
  );

  return user.id;
}

export const invitationService = {
  async accept(
    db: Db,
    clerkOrgId: string,
    clerkUserId: string,
    orgRole: string,
  ): Promise<void> {
    const clerkUser = await clerkClient.users.getUser(clerkUserId);
    const profileData = mapClerkApiUserToProfileData(clerkUserId, clerkUser);

    if (!profileData.email) {
      throw new ValidationError("Clerk user has no primary email");
    }

    const tenant = await tenantService.requireTenant(db, clerkOrgId);
    const membershipRow = await employeeRepository.findByEmail(db, tenant.organizationId, profileData.email);
    if (membershipRow?.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
      membershipRow.user.clerkUserId === profileData.clerkUserId
    ) {
      return;
    }

    let linkedUserId: string;
    try {
      linkedUserId = await db.transaction(async (tx) => {
        if (membershipRow) {
          return activateInvitedMembership(tx, {
            row: membershipRow,
            profileData,
            orgRole,
          });
        }

        const defaultLocation =
          tenant.locations.find((location) => location.isDefault) ??
          tenant.locations[0];

        if (!defaultLocation) {
          throw new InternalError("Organization has no default location");
        }

        return provisionNewMembership(tx, {
          organizationId: tenant.organizationId,
          profileData,
          orgRole,
          defaultLocationId: defaultLocation.id,
        });
      });
    } catch (error) {
      mapDbMutationError(error, {
        unique: () =>
          new InternalError("Failed to link user account to organization"),
      });
    }

    await membershipLocationsCache.invalidate(tenant.organizationId, linkedUserId);
  },
};
