import { z } from "zod";

export const organizationLocaleSchema = z.enum(["bg", "en"]);

export const organizationResponseSchema = z.object({
  id: z.uuid(),
  clerkOrgId: z.string(),
  name: z.string(),
  imageUrl: z.string(),
  hasImage: z.boolean(),
  timezone: z.string(),
  locale: organizationLocaleSchema,
  multipleLocationsEnabled: z.boolean(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type OrganizationResponse = z.infer<typeof organizationResponseSchema>;

export const updateOrganizationNameSchema = z.object({
  name: z.string().trim().min(1).max(256),
});

export type UpdateOrganizationNameInput = z.infer<
  typeof updateOrganizationNameSchema
>;

export const updateOrganizationSchema = z
  .object({
    timezone: z.string().min(1).optional(),
    locale: organizationLocaleSchema.optional(),
    multipleLocationsEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      Object.keys(data).length > 0 &&
      Object.values(data).some((value) => value !== undefined),
    { error: "At least one field must be provided" },
  );

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
