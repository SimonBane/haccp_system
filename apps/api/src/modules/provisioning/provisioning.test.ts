import { ORG_ROLE } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { MEMBERSHIP_STATUS } from "../../core/db/schema/organization-memberships.js";
import type { MembershipContextRow } from "../employees/employee.repository.js";
import { isHealthy, toBlob } from "./provisioning.service.js";

const ORG = "00000000-0000-4000-8000-00000000000o";
const USER = "00000000-0000-4000-8000-00000000000u";
const MEMBERSHIP = "00000000-0000-4000-8000-00000000000m";
const LOCATION = "00000000-0000-4000-8000-00000000000l";

function row(overrides: {
  membership?: Partial<MembershipContextRow["membership"]>;
  user?: Partial<MembershipContextRow["user"]>;
  locationIds?: string[];
}): MembershipContextRow {
  return {
    membership: {
      id: MEMBERSHIP,
      organizationId: ORG,
      userId: USER,
      role: ORG_ROLE.EMPLOYEE,
      status: MEMBERSHIP_STATUS.ACTIVE,
      clerkInvitationId: null,
      invitedAt: null,
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      ...overrides.membership,
    },
    user: {
      id: USER,
      clerkUserId: "user_abc",
      firstName: "Ann",
      lastName: "Lee",
      email: "ann@example.com",
      imageUrl: "",
      hasImage: false,
      deletedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      ...overrides.user,
    },
    locationIds: overrides.locationIds ?? [LOCATION],
  };
}

describe("isHealthy", () => {
  it("accepts an active employee with at least one location", () => {
    expect(isHealthy(row({}))).toBe(true);
  });

  it("accepts an active admin carrying no location assignments", () => {
    expect(
      isHealthy(
        row({ membership: { role: ORG_ROLE.ADMIN }, locationIds: [] }),
      ),
    ).toBe(true);
  });

  it("rejects an employee with no location assignments", () => {
    expect(isHealthy(row({ locationIds: [] }))).toBe(false);
  });

  it("rejects a soft-deleted membership", () => {
    expect(
      isHealthy(row({ membership: { deletedAt: new Date() } })),
    ).toBe(false);
  });

  it("rejects a soft-deleted user", () => {
    expect(isHealthy(row({ user: { deletedAt: new Date() } }))).toBe(false);
  });

  it("rejects a user with no Clerk identity linked yet", () => {
    expect(isHealthy(row({ user: { clerkUserId: null } }))).toBe(false);
  });

  it("rejects a membership that is not yet active", () => {
    for (const status of [MEMBERSHIP_STATUS.DRAFT, MEMBERSHIP_STATUS.INVITED]) {
      expect(isHealthy(row({ membership: { status } }))).toBe(false);
    }
  });

  it("ignores role drift entirely", () => {
    // Do not heal role from the JWT: a stale token after demotion would rewrite it.
    expect(isHealthy(row({ membership: { role: "org:something_else" } }))).toBe(
      true,
    );
  });
});

describe("toBlob", () => {
  it("projects the row onto the cached membership shape", () => {
    expect(toBlob(row({}))).toEqual({
      membershipId: MEMBERSHIP,
      organizationId: ORG,
      userId: USER,
      role: ORG_ROLE.EMPLOYEE,
      locationIds: [LOCATION],
    });
  });

  it("normalises an unrecognised role rather than caching it raw", () => {
    expect(toBlob(row({ membership: { role: "garbage" } })).role).toBe(
      ORG_ROLE.EMPLOYEE,
    );
  });

  it("preserves an admin role", () => {
    expect(toBlob(row({ membership: { role: ORG_ROLE.ADMIN } })).role).toBe(
      ORG_ROLE.ADMIN,
    );
  });

  it("carries every location assignment through", () => {
    const ids = [LOCATION, "00000000-0000-4000-8000-0000000000l2"];
    expect(toBlob(row({ locationIds: ids })).locationIds).toEqual(ids);
  });
});
