import { z } from "zod";
import { answersInputSchema, recordValuesSchema } from "../lib/form-answers.js";
import { CORRECTIVE_ACTION_MAX_LENGTH, recordResultSchema } from "./form.js";

export const taskRecordInputSchema = z.object({
  values: answersInputSchema,
  correctiveAction: z
    .string()
    .trim()
    .max(CORRECTIVE_ACTION_MAX_LENGTH)
    .optional(),
});

export type TaskRecordInput = z.infer<typeof taskRecordInputSchema>;

export const taskRecordParamSchema = z.object({
  locationId: z.uuid(),
  occurrenceId: z.uuid(),
});

export type TaskRecordParam = z.infer<typeof taskRecordParamSchema>;

export const taskRecordResponseSchema = z.object({
  id: z.uuid(),
  occurrenceId: z.uuid(),
  formVersionId: z.uuid(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  createdByUserId: z.uuid(),
  recordedAt: z.iso.datetime(),
  recordedByUserId: z.uuid(),
  voidedAt: z.iso.datetime().nullable(),
  voidedByUserId: z.uuid().nullable(),
  result: recordResultSchema,
  values: recordValuesSchema,
  correctiveAction: z.string().nullable(),
});

export type TaskRecordResponse = z.infer<typeof taskRecordResponseSchema>;
