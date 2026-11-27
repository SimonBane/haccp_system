import { z } from "zod";
import { itemLimitsSchema } from "./form.js";

export const TARGET_KIND = {
  EQUIPMENT: "equipment",
  AREA: "area",
  /** A part of an area checked on its own schedule: walls, floor, ceiling, door. */
  COMPONENT: "component",
} as const;

export const TARGET_KIND_VALUES = [
  TARGET_KIND.EQUIPMENT,
  TARGET_KIND.AREA,
  TARGET_KIND.COMPONENT,
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
    limits: itemLimitsSchema.default({}),
  })
  .refine(
    (input) => input.kind !== TARGET_KIND.COMPONENT || input.parentId !== null,
    { error: "A component must be part of an area", path: ["parentId"] },
  )
  .refine(
    (input) =>
      input.kind !== TARGET_KIND.COMPONENT ||
      Object.keys(input.limits).length === 0,
    { error: "A component has no allowed range of its own", path: ["limits"] },
  );

export type TargetInput = z.infer<typeof targetInputSchema>;

export const TARGET_DUPLICATE_MAX_CONTENTS = 500;

/** A copy of an item; `contents` are the items inside it to copy along, each named for its copy. */
export const targetDuplicateInputSchema = z
  .object({
    target: targetInputSchema,
    contents: z
      .array(z.object({ sourceId: z.uuid(), name: targetNameSchema }))
      .max(TARGET_DUPLICATE_MAX_CONTENTS)
      .default([]),
  })
  .refine(
    (input) =>
      new Set(input.contents.map((item) => item.sourceId)).size ===
      input.contents.length,
    { error: "Each item can be copied once", path: ["contents"] },
  );

export type TargetDuplicateInput = z.infer<typeof targetDuplicateInputSchema>;

export const targetResponseSchema = z.object({
  id: z.uuid(),
  locationId: z.uuid(),
  name: z.string(),
  kind: targetKindSchema,
  parentId: z.uuid().nullable(),
  limits: itemLimitsSchema,
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

/** Mirrors the database's unique index: a component name repeats across areas ("Walls"), anything else is unique per location. */
export function isTargetNameTaken(
  existing: readonly NamedTarget[],
  candidate: Omit<NamedTarget, "id"> & { id?: string },
): boolean {
  const isComponent = candidate.kind === TARGET_KIND.COMPONENT;
  return existing.some(
    (item) =>
      item.id !== candidate.id &&
      item.name === candidate.name &&
      (item.kind === TARGET_KIND.COMPONENT) === isComponent &&
      (!isComponent || item.parentId === candidate.parentId),
  );
}

const AREA_SEPARATOR = " › ";

/** "Kitchen 2 › Walls": a component's own name says nothing once it leaves its area's list. */
export function targetDisplayName(
  target: { name: string; kind: TargetKind | string },
  parentName: string | null | undefined,
): string {
  return target.kind === TARGET_KIND.COMPONENT && parentName
    ? `${parentName}${AREA_SEPARATOR}${target.name}`
    : target.name;
}

/** Records keep only the display name they were snapshotted with, so the area is read back from it. */
export function splitTargetDisplayName(displayName: string): {
  area: string | null;
  name: string;
} {
  const at = displayName.indexOf(AREA_SEPARATOR);
  return at === -1
    ? { area: null, name: displayName }
    : {
        area: displayName.slice(0, at),
        name: displayName.slice(at + AREA_SEPARATOR.length),
      };
}
