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

// Admin `[]` means all locations; employees always need at least one.
const employeeLocationIdsSchema = z.array(z.uuid());

export function requiresLocationAssignments(role: OrgRole | string): boolean {
  return role !== ORG_ROLE.ADMIN;
}

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

// Unrecognized Clerk role degrades to employee — never throws (provisioning runs on every request).
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
        // `params.rule` for i18n; a literal message here would outrank the web error map.
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
    locationIds: employeeLocationIdsSchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { error: "At least one field must be provided" },
  );

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;

export const updateEmployeeRoleSchema = z.object({
  role: orgRoleSchema,
});

export type UpdateEmployeeRoleInput = z.infer<typeof updateEmployeeRoleSchema>;
