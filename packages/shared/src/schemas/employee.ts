import { z } from "zod";
import {
  optionalPersonNameSchema,
  personNameSchema,
  trimmedEmailSchema,
} from "./fields.js";
import { locationResponseSchema } from "./location.js";
import { userResponseSchema } from "./user.js";

export const membershipStatusSchema = z.enum(["draft", "invited", "active"]);

export type MembershipStatus = z.infer<typeof membershipStatusSchema>;

export const ORG_ROLE = {
  ADMIN: "org:admin",
  EMPLOYEE: "org:employee",
} as const;

export const orgRoleSchema = z.enum([ORG_ROLE.ADMIN, ORG_ROLE.EMPLOYEE]);

export type OrgRole = z.infer<typeof orgRoleSchema>;

// Admins reach every location in their org, so an admin membership carries no
// assignments at all and [] means "all". Employees always need at least one.
const employeeLocationIdsSchema = z.array(z.uuid());

export function requiresLocationAssignments(role: OrgRole | string): boolean {
  return role !== ORG_ROLE.ADMIN;
}

/**
 * Whether a submission is missing a location selection it needs.
 *
 * The rule differs by side and that is intentional — the API always enforces it,
 * while the form additionally waives it for single-location organisations, where
 * there is nothing to choose and the assignment is filled in for the user. Only
 * the condition is shared, so the two cannot drift apart; the message stays with
 * whoever is showing it.
 */
export function needsLocationSelection(input: {
  role: OrgRole | string;
  locationIds: readonly string[];
  multipleLocationsEnabled?: boolean;
}): boolean {
  if (input.multipleLocationsEnabled === false) {
    return false;
  }

  return (
    requiresLocationAssignments(input.role) && input.locationIds.length === 0
  );
}

const LEGACY_MEMBER_ROLE = "org:member";

export function normalizeOrgRole(role: string): OrgRole {
  if (role === LEGACY_MEMBER_ROLE) {
    return ORG_ROLE.EMPLOYEE;
  }

  return orgRoleSchema.parse(role);
}

// Never throws. Provisioning runs on every request, so an unrecognized Clerk
// role must degrade to the least-privileged one rather than fail the request.
export function safeNormalizeOrgRole(role: string | null | undefined): OrgRole {
  if (role === ORG_ROLE.ADMIN) {
    return ORG_ROLE.ADMIN;
  }

  return ORG_ROLE.EMPLOYEE;
}

export const employeeResponseSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: orgRoleSchema,
  status: membershipStatusSchema,
  locationIds: z.array(z.uuid()),
  locations: z.array(locationResponseSchema),
  invitedAt: z.iso.datetime().nullable(),
  user: userResponseSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type EmployeeResponse = z.infer<typeof employeeResponseSchema>;

export const employeeListResponseSchema = z.object({
  items: z.array(employeeResponseSchema),
});

export type EmployeeListResponse = z.infer<typeof employeeListResponseSchema>;

export const createEmployeeSchema = z
  .object({
    email: trimmedEmailSchema,
    firstName: personNameSchema,
    lastName: personNameSchema,
    role: orgRoleSchema,
    locationIds: employeeLocationIdsSchema,
    inviteNow: z.boolean().optional(),
  })
  .check((ctx) => {
    if (needsLocationSelection(ctx.value)) {
      ctx.issues.push({
        code: "custom",
        path: ["locationIds"],
        // `params.rule` is what lets the web app's error map translate this;
        // a literal message here would outrank the map and stay English.
        params: { rule: "locationsRequired" },
        message: "Select at least one location.",
        input: ctx.value.locationIds,
      });
    }
  });

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    email: trimmedEmailSchema.optional(),
    firstName: optionalPersonNameSchema.nullable().optional(),
    lastName: optionalPersonNameSchema.nullable().optional(),
    role: orgRoleSchema.optional(),
    locationIds: employeeLocationIdsSchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { error: "At least one field must be provided" },
  );

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
