import { z } from "zod";

export const TARGET_KIND = {
  EQUIPMENT: "equipment",
  AREA: "area",
  SURFACE: "surface",
  VEHICLE: "vehicle",
} as const;

export const TARGET_KIND_VALUES = [
  TARGET_KIND.EQUIPMENT,
  TARGET_KIND.AREA,
  TARGET_KIND.SURFACE,
  TARGET_KIND.VEHICLE,
] as const;

export const targetKindSchema = z.enum(TARGET_KIND_VALUES);

export type TargetKind = z.infer<typeof targetKindSchema>;

const targetNameSchema = z.string().trim().min(1).max(100);

export const targetTypeInputSchema = z.object({
  name: targetNameSchema,
  kind: targetKindSchema,
});

export type TargetTypeInput = z.infer<typeof targetTypeInputSchema>;

export const targetTypeIdParamSchema = z.object({
  targetTypeId: z.uuid(),
});

export const targetTypeResponseSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  kind: targetKindSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TargetTypeResponse = z.infer<typeof targetTypeResponseSchema>;

export const targetTypeListResponseSchema = z.object({
  items: z.array(targetTypeResponseSchema),
});

export type TargetTypeListResponse = z.infer<
  typeof targetTypeListResponseSchema
>;

/** Offered to an organisation with no types yet; names are created in the admin's language. */
export const STARTER_TARGET_TYPES: ReadonlyArray<{
  key: string;
  kind: TargetKind;
  name: { bg: string; en: string };
}> = [
  { key: "fridge", kind: "equipment", name: { bg: "Хладилник", en: "Fridge" } },
  { key: "freezer", kind: "equipment", name: { bg: "Фризер", en: "Freezer" } },
  {
    key: "display_case",
    kind: "equipment",
    name: { bg: "Хладилна витрина", en: "Display case" },
  },
  { key: "room", kind: "area", name: { bg: "Помещение", en: "Room" } },
  {
    key: "work_surface",
    kind: "surface",
    name: { bg: "Работна повърхност", en: "Work surface" },
  },
  {
    key: "delivery_vehicle",
    kind: "vehicle",
    name: { bg: "Транспортно средство", en: "Delivery vehicle" },
  },
];

export const targetInputSchema = z.object({
  name: targetNameSchema,
  targetTypeId: z.uuid(),
  parentId: z.uuid().nullable().default(null),
});

export type TargetInput = z.infer<typeof targetInputSchema>;

export const targetResponseSchema = z.object({
  id: z.uuid(),
  locationId: z.uuid(),
  name: z.string(),
  targetTypeId: z.uuid(),
  targetTypeName: z.string(),
  kind: targetKindSchema,
  parentId: z.uuid().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TargetResponse = z.infer<typeof targetResponseSchema>;

export const targetListResponseSchema = z.object({
  items: z.array(targetResponseSchema),
});

export type TargetListResponse = z.infer<typeof targetListResponseSchema>;
