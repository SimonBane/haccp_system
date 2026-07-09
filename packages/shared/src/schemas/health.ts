import { z } from "zod";

export const healthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.string(),
  timestamp: z.string().datetime(),
  database: z.literal("connected"),
});

export type HealthResponseSchema = z.infer<typeof healthResponseSchema>;
