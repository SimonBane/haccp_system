import { z } from "zod";
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

const employeeLocationIdsSchema = z
  .array(z.string().uuid())
  .min(1, "Select at least one location.");

const LEGACY_MEMBER_ROLE = "org:member";

export function normalizeOrgRole(role: string): OrgRole {
  if (role === LEGACY_MEMBER_ROLE) {
    return ORG_ROLE.EMPLOYEE;
  }

  return orgRoleSchema.parse(role);
}

export const employeeResponseSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  role: orgRoleSchema,
  status: membershipStatusSchema,
  locationIds: z.array(z.string().uuid()),
  locations: z.array(locationResponseSchema),
  invitedAt: z.string().datetime().nullable(),
  user: userResponseSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EmployeeResponse = z.infer<typeof employeeResponseSchema>;

export const employeeListResponseSchema = z.object({
  items: z.array(employeeResponseSchema),
});

export type EmployeeListResponse = z.infer<typeof employeeListResponseSchema>;

export const createEmployeeSchema = z.object({
  email: z.string().trim().email().max(256),
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: orgRoleSchema,
  locationIds: employeeLocationIdsSchema,
  inviteNow: z.boolean().optional(),
});

export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = z
  .object({
    email: z.string().trim().email().max(256).optional(),
    firstName: z.string().trim().max(100).nullable().optional(),
    lastName: z.string().trim().max(100).nullable().optional(),
    role: orgRoleSchema.optional(),
    locationIds: employeeLocationIdsSchema.optional(),
  })
  .refine(
    (data) => Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
