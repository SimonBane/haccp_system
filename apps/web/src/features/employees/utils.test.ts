import type { EmployeeResponse } from "@haccp/shared";
import { describe, expect, it } from "vitest";
import { resolveEmployeeUpdatePlan, sameLocationIds } from "./utils";

const LOCATION_A = "00000000-0000-4000-8000-00000000loc1";
const LOCATION_B = "00000000-0000-4000-8000-00000000loc2";

function employee(overrides: Partial<EmployeeResponse> = {}): EmployeeResponse {
  return {
    id: "00000000-0000-4000-8000-00000000emp1",
    email: "emil@example.test",
    firstName: "Emil",
    lastName: "Employee",
    role: "org:employee",
    status: "active",
    locationIds: [LOCATION_A],
    locations: [],
    invitedAt: null,
    user: {
      id: "00000000-0000-4000-8000-00000000usr1",
      clerkUserId: "user_test",
      firstName: "Emil",
      lastName: "Employee",
      email: "emil@example.test",
      imageUrl: "",
      hasImage: false,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("sameLocationIds", () => {
  it("is true for the same set regardless of order", () => {
    expect(sameLocationIds([LOCATION_A, LOCATION_B], [LOCATION_B, LOCATION_A])).toBe(
      true,
    );
  });

  it("is false when lengths differ", () => {
    expect(sameLocationIds([LOCATION_A], [LOCATION_A, LOCATION_B])).toBe(false);
  });

  it("is false when the sets differ", () => {
    expect(sameLocationIds([LOCATION_A], [LOCATION_B])).toBe(false);
  });
});

describe("resolveEmployeeUpdatePlan", () => {
  it("plans a role update for an active employee whose role changed", () => {
    const plan = resolveEmployeeUpdatePlan(employee({ status: "active" }), {
      email: "emil@example.test",
      firstName: "Emil",
      lastName: "Employee",
      role: "org:admin",
    });

    expect(plan).toEqual({ kind: "role", role: "org:admin" });
  });

  it("plans nothing for an active employee when nothing changed", () => {
    const plan = resolveEmployeeUpdatePlan(employee({ status: "active" }), {
      email: "emil@example.test",
      firstName: "Emil",
      lastName: "Employee",
      role: "org:employee",
    });

    expect(plan).toBeNull();
  });

  it("ignores a changed email/name for an active employee — only role is plannable", () => {
    const plan = resolveEmployeeUpdatePlan(employee({ status: "active" }), {
      email: "new@example.test",
      firstName: "New",
      lastName: "Name",
      role: "org:employee",
    });

    expect(plan).toBeNull();
  });

  it("plans a profile update for a draft employee whose name changed", () => {
    const plan = resolveEmployeeUpdatePlan(employee({ status: "draft" }), {
      email: "emil@example.test",
      firstName: "Nova",
      lastName: "Employee",
      role: "org:employee",
    });

    expect(plan).toEqual({
      kind: "profile",
      email: "emil@example.test",
      firstName: "Nova",
      lastName: "Employee",
      role: "org:employee",
    });
  });

  it("plans a profile update for an invited employee whose role changed", () => {
    const plan = resolveEmployeeUpdatePlan(employee({ status: "invited" }), {
      email: "emil@example.test",
      firstName: "Emil",
      lastName: "Employee",
      role: "org:admin",
    });

    expect(plan?.kind).toBe("profile");
  });

  it("plans nothing for a draft/invited employee when nothing changed", () => {
    const plan = resolveEmployeeUpdatePlan(employee({ status: "draft" }), {
      email: "emil@example.test",
      firstName: "Emil",
      lastName: "Employee",
      role: "org:employee",
    });

    expect(plan).toBeNull();
  });
});
