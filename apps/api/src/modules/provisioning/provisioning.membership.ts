import type { LocationResponse, OrgRole } from "@haccp/shared";
import type { DbClient } from "../../core/db/client.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import { InternalError } from "../../core/errors/app-errors.js";
import type { MembershipContextRow } from "../employees/employee.repository.js";
import { employeeRepository } from "../employees/employee.repository.js";
import {
  resolveLocationAssignments,
  sameLocationIds,
} from "../employees/employee.locations.js";
import type { ClerkProfileData } from "../users/user.mapper.js";
import { userService } from "../users/user.service.js";

export type ProvisionAction =
  | "jit_membership_created"
  | "jit_membership_activated";

export type ProvisionedMembership = MembershipContextRow & {
  action: ProvisionAction;
};

type ProvisionInput = {
  organizationId: string;
  profileData: ClerkProfileData;
  role: OrgRole;
  tenantLocations: LocationResponse[];
};

async function writeLocationAssignments(
  tx: DbClient,
  input: {
    membershipId: string;
    organizationId: string;
    role: OrgRole;
    current: string[];
    tenantLocations: LocationResponse[];
  },
): Promise<string[]> {
  const target = resolveLocationAssignments(
    input.role,
    input.current,
    input.tenantLocations,
  );

  if (sameLocationIds(input.current, target)) {
    return input.current;
  }

  await employeeRepository.replaceLocationAssignments(
    tx,
    input.membershipId,
    input.organizationId,
    target,
  );

  return target;
}

export async function activateMembership(
  tx: DbClient,
  input: ProvisionInput & { row: MembershipContextRow },
): Promise<ProvisionedMembership> {
  const user = await userService.linkClerkProfileToDraftUser(
    tx,
    input.row.user.id,
    { ...input.profileData, deletedAt: null },
  );

  const membership = await employeeRepository.updateById(
    tx,
    input.row.membership.id,
    {
      userId: user.id,
      role: input.role,
      status: MEMBERSHIP_STATUS.ACTIVE,
      deletedAt: null,
      invitedAt: input.row.membership.invitedAt ?? new Date(),
    },
  );

  if (!membership) {
    throw new InternalError("Failed to activate membership");
  }

  // Preserve invite-time assignments; backfill the default only when there are none.
  const locationIds = await writeLocationAssignments(tx, {
    membershipId: membership.id,
    organizationId: input.organizationId,
    role: input.role,
    current: input.row.locationIds,
    tenantLocations: input.tenantLocations,
  });

  return {
    membership,
    user,
    locationIds,
    action: "jit_membership_activated",
  };
}

export async function provisionNewMembership(
  tx: DbClient,
  input: ProvisionInput,
): Promise<ProvisionedMembership> {
  const user = await userService.upsertUserFromClerk(tx, {
    ...input.profileData,
    deletedAt: null,
  });

  const membership = await employeeRepository.insert(tx, {
    organizationId: input.organizationId,
    userId: user.id,
    role: input.role,
    status: MEMBERSHIP_STATUS.ACTIVE,
    invitedAt: new Date(),
  });

  if (!membership) {
    throw new InternalError("Failed to create membership");
  }

  const locationIds = await writeLocationAssignments(tx, {
    membershipId: membership.id,
    organizationId: input.organizationId,
    role: input.role,
    current: [],
    tenantLocations: input.tenantLocations,
  });

  return {
    membership,
    user,
    locationIds,
    action: "jit_membership_created",
  };
}
