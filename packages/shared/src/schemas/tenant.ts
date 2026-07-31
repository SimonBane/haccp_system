import { z } from "zod";
import { locationResponseSchema } from "./location.js";
import { organizationResponseSchema } from "./organization.js";

export const tenantContextResponseSchema = z.object({
  organization: organizationResponseSchema,
  locations: z.array(locationResponseSchema),
});

export type TenantContextResponse = z.infer<typeof tenantContextResponseSchema>;

export const createLocationSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isDefault: z.boolean().optional(),
});

export type CreateLocationInput = z.infer<typeof createLocationSchema>;

export const updateLocationSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isDefault: z.boolean().optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).length > 0 &&
      Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  );

export type UpdateLocationInput = z.infer<typeof updateLocationSchema>;

export const locationListResponseSchema = z.object({
  items: z.array(locationResponseSchema),
});

export type LocationListResponse = z.infer<typeof locationListResponseSchema>;
