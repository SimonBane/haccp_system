import { z } from "zod";
import { answersInputSchema, recordValuesSchema } from "../lib/form-answers.js";
import {
  CORRECTIVE_ACTION_MAX_LENGTH,
  CORRECTIVE_MAX_ANSWERS,
  formElementIdSchema,
  recordResultSchema,
} from "./form.js";
import { recordKindSchema, recordsCalendarDateSchema } from "./records.js";
import { scheduledTimeSchema } from "./task-template.js";

/** What was chosen and written about a failed check, so it can be edited again as entered. */
export const recordCorrectiveSchema = z.object({
  answerIds: z.array(formElementIdSchema),
  note: z.string().nullable(),
});

export type RecordCorrective = z.infer<typeof recordCorrectiveSchema>;

export const taskRecordInputSchema = z.object({
  values: answersInputSchema,
  /** The free-text note; the form's own answers go in `correctiveAnswerIds`. */
  correctiveAction: z
    .string()
    .trim()
    .max(CORRECTIVE_ACTION_MAX_LENGTH)
    .optional(),
  correctiveAnswerIds: z
    .array(formElementIdSchema)
    .max(CORRECTIVE_MAX_ANSWERS)
    .optional(),
});

export type TaskRecordInput = z.infer<typeof taskRecordInputSchema>;

export const onDemandRecordInputSchema = taskRecordInputSchema.extend({
  /** The version the form was filled against; a newer one means the client must reload. */
  formVersionId: z.uuid(),
  targetId: z.uuid().nullable(),
  entryDate: recordsCalendarDateSchema,
  entryTime: scheduledTimeSchema,
});

export type OnDemandRecordInput = z.infer<typeof onDemandRecordInputSchema>;

export const taskRecordParamSchema = z.object({
  locationId: z.uuid(),
  occurrenceId: z.uuid(),
});

export type TaskRecordParam = z.infer<typeof taskRecordParamSchema>;

export const recordParamSchema = z.object({
  locationId: z.uuid(),
  recordId: z.uuid(),
});

export type RecordParam = z.infer<typeof recordParamSchema>;

export const onDemandFormParamSchema = z.object({
  locationId: z.uuid(),
  formId: z.uuid(),
});

export type OnDemandFormParam = z.infer<typeof onDemandFormParamSchema>;

export const taskRecordResponseSchema = z.object({
  id: z.uuid(),
  kind: recordKindSchema,
  occurrenceId: z.uuid().nullable(),
  taskTemplateId: z.uuid().nullable(),
  formVersionId: z.uuid(),
  entryDate: recordsCalendarDateSchema,
  entryTime: scheduledTimeSchema,
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
  corrective: recordCorrectiveSchema.nullable().optional(),
});

export type TaskRecordResponse = z.infer<typeof taskRecordResponseSchema>;
