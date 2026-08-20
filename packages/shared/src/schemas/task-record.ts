import { z } from "zod";
import { temperatureResultSchema } from "./today.js";

export const RECORD_TEMPERATURE_MIN_C = -99.9;
export const RECORD_TEMPERATURE_MAX_C = 99.9;

export const RECORD_KIND = {
  ORDINARY: "ordinary",
  TEMPERATURE: "temperature",
} as const;

export const recordKindSchema = z.enum([
  RECORD_KIND.ORDINARY,
  RECORD_KIND.TEMPERATURE,
]);

export type RecordKind = z.infer<typeof recordKindSchema>;

const ordinaryRecordInputSchema = z.object({
  kind: z.literal(RECORD_KIND.ORDINARY),
});

const temperatureRecordInputSchema = z.object({
  kind: z.literal(RECORD_KIND.TEMPERATURE),
  recordedC: z.coerce
    .number()
    .min(RECORD_TEMPERATURE_MIN_C, {
      error: `Temperature must be at least ${RECORD_TEMPERATURE_MIN_C}°C`,
    })
    .max(RECORD_TEMPERATURE_MAX_C, {
      error: `Temperature must be at most ${RECORD_TEMPERATURE_MAX_C}°C`,
    }),
  correctiveAction: z.string().trim().max(1000).optional(),
});

export const taskRecordInputSchema = z.discriminatedUnion("kind", [
  ordinaryRecordInputSchema,
  temperatureRecordInputSchema,
]);

export type TaskRecordInput = z.infer<typeof taskRecordInputSchema>;
export type OrdinaryRecordInput = z.infer<typeof ordinaryRecordInputSchema>;
export type TemperatureRecordInput = z.infer<
  typeof temperatureRecordInputSchema
>;

export const taskRecordParamSchema = z.object({
  locationId: z.uuid(),
  occurrenceId: z.uuid(),
});

export type TaskRecordParam = z.infer<typeof taskRecordParamSchema>;

export const taskRecordTemperatureDetailSchema = z.object({
  recordedC: z.number(),
  minTempC: z.number(),
  maxTempC: z.number(),
  result: temperatureResultSchema,
  correctiveAction: z.string().nullable(),
});

export type TaskRecordTemperatureDetail = z.infer<
  typeof taskRecordTemperatureDetailSchema
>;

export const taskRecordResponseSchema = z.object({
  id: z.uuid(),
  occurrenceId: z.uuid(),
  active: z.boolean(),
  createdAt: z.iso.datetime(),
  createdByUserId: z.uuid(),
  recordedAt: z.iso.datetime(),
  recordedByUserId: z.uuid(),
  voidedAt: z.iso.datetime().nullable(),
  voidedByUserId: z.uuid().nullable(),
  temperature: taskRecordTemperatureDetailSchema.nullable(),
});

export type TaskRecordResponse = z.infer<typeof taskRecordResponseSchema>;
