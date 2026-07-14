import { z } from "zod";

export const locationResponseSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type LocationResponse = z.infer<typeof locationResponseSchema>;
