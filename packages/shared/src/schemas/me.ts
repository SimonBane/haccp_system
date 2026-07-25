import { z } from "zod";

export const meResponseSchema = z.object({
  userId: z.string(),
  orgId: z.string().nullable(),
  orgRole: z.string().nullable(),
});

export type MeResponse = z.infer<typeof meResponseSchema>;
