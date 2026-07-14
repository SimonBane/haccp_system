import { z } from "zod";

export const equipmentTypeSchema = z.enum([
  "fridge",
  "freezer",
  "display_case",
]);

export type EquipmentType = z.infer<typeof equipmentTypeSchema>;

export const EQUIPMENT_DEFAULT_TEMPS: Record<
  EquipmentType,
  { minTempC: number; maxTempC: number }
> = {
  fridge: { minTempC: 0, maxTempC: 4 },
  freezer: { minTempC: -25, maxTempC: -18 },
  display_case: { minTempC: 0, maxTempC: 4 },
};

const tempSchema = z.coerce
  .number()
  .min(-40, "Temperature must be at least -40°C")
  .max(15, "Temperature must be at most 15°C");

const equipmentBaseSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: equipmentTypeSchema,
  minTempC: tempSchema,
  maxTempC: tempSchema,
});

function withTempRangeValidation<T extends z.ZodTypeAny>(schema: T) {
  return schema.superRefine((data, ctx) => {
    const value = data as { minTempC: number; maxTempC: number };
    if (value.minTempC >= value.maxTempC) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Minimum temperature must be less than maximum temperature",
        path: ["minTempC"],
      });
    }
  });
}

export const createEquipmentSchema = withTempRangeValidation(equipmentBaseSchema);

export type CreateEquipmentInput = z.infer<typeof createEquipmentSchema>;

export const updateEquipmentSchema = withTempRangeValidation(
  equipmentBaseSchema.partial().refine(
    (data) =>
      Object.keys(data).length > 0 &&
      Object.values(data).some((value) => value !== undefined),
    { message: "At least one field must be provided" },
  ),
);

export type UpdateEquipmentInput = z.infer<typeof updateEquipmentSchema>;

export const equipmentResponseSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string(),
  locationId: z.string().uuid(),
  name: z.string(),
  type: equipmentTypeSchema,
  minTempC: z.number(),
  maxTempC: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type EquipmentResponse = z.infer<typeof equipmentResponseSchema>;

export const equipmentListResponseSchema = z.object({
  items: z.array(equipmentResponseSchema),
});

export type EquipmentListResponse = z.infer<typeof equipmentListResponseSchema>;
