import {
  getLocalizedPath,
  normalizeOrgRole,
  type AppLocale,
  type OrgRole,
} from "@haccp/shared";
import { clerkClient } from "../../core/auth/clerk-client.js";
import {
  callClerk,
  callClerkWrite,
  withClerkTimeout,
} from "../../core/auth/clerk-errors.js";
import { env } from "../../env.js";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { OrganizationMembership } from "../../core/db/schema/organization-memberships.js";
import type { User } from "../../core/db/schema/users.js";
import { ValidationError } from "../../core/errors/app-errors.js";
import { logger } from "../../lib/logger.js";
import type { EmployeeChanges } from "./employee.changes.js";

export type ClerkMembershipRole = { role: string; updatedAt: Date };

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
    return await withClerkTimeout(
      clerkClient.organizations.createOrganizationInvitation({
        organizationId: clerkOrgId,
        inviterUserId,
        emailAddress: email,
        role: normalizeOrgRole(role),
        redirectUrl: buildInvitationRedirectUrl(locale, firstName, lastName),
      }),
    );
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
  await withClerkTimeout(
    clerkClient.organizations.revokeOrganizationInvitation({
      organizationId: clerkOrgId,
      invitationId,
    }),
  );
}

export async function removeClerkOrganizationMembership(
  clerkOrgId: string,
  clerkUserId: string,
): Promise<void> {
  await withClerkTimeout(
    clerkClient.organizations.deleteOrganizationMembership({
      organizationId: clerkOrgId,
      userId: clerkUserId,
    }),
  );
}

export async function applyActiveEmployeeProfileUpdate(
  clerkUserId: string,
  changes: EmployeeChanges,
  nextUser: User,
): Promise<void> {
  if (changes.firstName !== undefined || changes.lastName !== undefined) {
    await withClerkTimeout(
      clerkClient.users.updateUser(clerkUserId, {
        firstName: nextUser.firstName,
        lastName: nextUser.lastName,
      }),
    );
  }
}

// Clerk-first role write. A 4xx (including the last-admin guard) throws a
// ValidationError; a timeout/network/5xx throws RoleUpdateOutcomeUnknownError, which
// the caller must resolve with fetchClerkMembershipRole rather than assume failed.
export async function updateClerkMembershipRole(
  clerkOrgId: string,
  clerkUserId: string,
  role: OrgRole,
): Promise<ClerkMembershipRole> {
  const membership = await callClerkWrite(
    clerkClient.organizations.updateOrganizationMembership({
      organizationId: clerkOrgId,
      userId: clerkUserId,
      role,
    }),
    {
      rejectionMessage: "The selected organization role is not available",
      logContext: { clerkOrgId, clerkUserId },
    },
  );

  // Clerk's OrganizationMembership.updatedAt is epoch milliseconds, not a Date,
  // despite what the hosted docs say — verified against the installed SDK's .d.ts.
  return { role: membership.role, updatedAt: new Date(membership.updatedAt) };
}

// The disambiguating re-read after an ambiguous write, and the source of truth for
// webhook-driven convergence — never trust a webhook payload's role, re-read this.
export async function fetchClerkMembershipRole(
  clerkOrgId: string,
  clerkUserId: string,
): Promise<ClerkMembershipRole | null> {
  const memberships = await callClerk(
    clerkClient.organizations.getOrganizationMembershipList({
      organizationId: clerkOrgId,
      userId: [clerkUserId],
      limit: 1,
    }),
    {
      notFoundMessage: "This organization is no longer available",
      notFoundLog: "Clerk organization missing while reading membership role",
      failureLog: "Clerk membership lookup failed while reading role",
      logContext: { clerkOrgId, clerkUserId },
    },
  );

  const current = memberships.data[0];
  return current
    ? { role: current.role, updatedAt: new Date(current.updatedAt) }
    : null;
}

// Best-effort: stops the user's active sessions from refreshing, so a demoted
// admin loses access at most one refresh cycle later rather than waiting out
// their token's full remaining lifetime. Never invalidates an already-issued,
// stateless JWT retroactively — that is bounded by the token's own exp, not by
// this. Failures are logged and never thrown; the caller's role change already
// succeeded and must not fail because of this.
export async function revokeClerkUserSessions(clerkUserId: string): Promise<void> {
  try {
    const { data: sessions } = await withClerkTimeout(
      clerkClient.sessions.getSessionList({ userId: clerkUserId, status: "active" }),
    );

    await Promise.all(
      sessions.map((session) =>
        withClerkTimeout(clerkClient.sessions.revokeSession(session.id)).catch(
          (err: unknown) => {
            logger.warn(
              { err, clerkUserId, sessionId: session.id },
              "Failed to revoke a session after demotion",
            );
          },
        ),
      ),
    );
  } catch (err) {
    logger.warn(
      { err, clerkUserId },
      "Failed to list sessions for revocation after demotion",
    );
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
