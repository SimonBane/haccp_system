import { z } from "zod";

export const TARGET_KIND = {
  EQUIPMENT: "equipment",
  AREA: "area",
  /** A part of an area checked on its own schedule: walls, floor, ceiling, door. */
  FIXTURE: "fixture",
} as const;

export const TARGET_KIND_VALUES = [
  TARGET_KIND.EQUIPMENT,
  TARGET_KIND.AREA,
  TARGET_KIND.FIXTURE,
] as const;

export const targetKindSchema = z.enum(TARGET_KIND_VALUES);

export type TargetKind = z.infer<typeof targetKindSchema>;

/** Mirrored by the `targets_name_length` check in the database. */
export const TARGET_NAME_MAX_LENGTH = 100;

const targetNameSchema = z.string().trim().min(1).max(TARGET_NAME_MAX_LENGTH);

export const targetInputSchema = z
  .object({
    name: targetNameSchema,
    kind: targetKindSchema,
    /** Must be an area: equipment stands in a room, and areas may nest inside larger ones. */
    parentId: z.uuid().nullable().default(null),
  })
  .refine(
    (input) => input.kind !== TARGET_KIND.FIXTURE || input.parentId !== null,
    { error: "A fixture must be part of an area", path: ["parentId"] },
  );

export type TargetInput = z.infer<typeof targetInputSchema>;

export const targetResponseSchema = z.object({
  id: z.uuid(),
  locationId: z.uuid(),
  name: z.string(),
  kind: targetKindSchema,
  parentId: z.uuid().nullable(),
  /** Active task templates that check it. */
  taskCount: z.int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type TargetResponse = z.infer<typeof targetResponseSchema>;

export const targetListResponseSchema = z.object({
  items: z.array(targetResponseSchema),
});

export type TargetListResponse = z.infer<typeof targetListResponseSchema>;

type NamedTarget = {
  id: string;
  name: string;
  kind: TargetKind;
  parentId: string | null;
};

/** Mirrors the database's unique index: a fixture name repeats across areas ("Walls"), anything else is unique per location. */
export function isTargetNameTaken(
  existing: readonly NamedTarget[],
  candidate: Omit<NamedTarget, "id"> & { id?: string },
): boolean {
  const isFixture = candidate.kind === TARGET_KIND.FIXTURE;
  return existing.some(
    (item) =>
      item.id !== candidate.id &&
      item.name === candidate.name &&
      (item.kind === TARGET_KIND.FIXTURE) === isFixture &&
      (!isFixture || item.parentId === candidate.parentId),
  );
}

/** "Kitchen 2 › Walls": a fixture's own name says nothing once it leaves its area's list. */
export function targetDisplayName(
  target: { name: string; kind: TargetKind | string },
  parentName: string | null | undefined,
): string {
  return target.kind === TARGET_KIND.FIXTURE && parentName
    ? `${parentName} › ${target.name}`
    : target.name;
}
