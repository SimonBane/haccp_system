import { getLocalizedPath, normalizeOrgRole, type AppLocale } from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import { env } from "../../env.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import { ValidationError } from "../../core/errors/app-errors.js";
import type { EmployeeChanges } from "./employee.changes.js";

function buildInvitationRedirectUrl(
  locale: AppLocale,
  firstName: string,
  lastName: string,
): string {
  const params = new URLSearchParams({ firstName, lastName });
  const path = getLocalizedPath(locale, "/accept-invitation");
  return `${env.WEB_APP_URL}${path}?${params.toString()}`;
}

export async function sendClerkInvitation(
  locale: AppLocale,
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
      redirectUrl: buildInvitationRedirectUrl(locale, firstName, lastName),
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

export async function revokeClerkInvitation(
  clerkOrgId: string,
  invitationId: string,
): Promise<void> {
  await clerkClient.organizations.revokeOrganizationInvitation({
    organizationId: clerkOrgId,
    invitationId,
  });
}

export async function removeClerkOrganizationMembership(
  clerkOrgId: string,
  clerkUserId: string,
): Promise<void> {
  await clerkClient.organizations.deleteOrganizationMembership({
    organizationId: clerkOrgId,
    userId: clerkUserId,
  });
}

export async function applyActiveEmployeeUpdate(
  clerkOrgId: string,
  clerkUserId: string,
  changes: EmployeeChanges,
  nextUser: User,
): Promise<void> {
  if (changes.firstName !== undefined || changes.lastName !== undefined) {
    await clerkClient.users.updateUser(clerkUserId, {
      firstName: nextUser.firstName,
      lastName: nextUser.lastName,
    });
  }
}

export async function syncClerkMembershipRemoval(
  clerkOrgId: string,
  row: { membership: OrganizationMembership; user: User },
): Promise<void> {
  if (
    row.membership.status === MEMBERSHIP_STATUS.INVITED &&
    row.membership.clerkInvitationId
  ) {
    await revokeClerkInvitation(
      clerkOrgId,
      row.membership.clerkInvitationId,
    );
  }

  if (
    row.membership.status === MEMBERSHIP_STATUS.ACTIVE &&
    row.user.clerkUserId
  ) {
    await removeClerkOrganizationMembership(clerkOrgId, row.user.clerkUserId);
  }
}
