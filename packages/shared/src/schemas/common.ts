import { z } from "zod";

export const uuidParamSchema = z.object({
  id: z.string().uuid(),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

export const locationIdParamSchema = z.object({
  locationId: z.string().uuid(),
});

export type LocationIdParam = z.infer<typeof locationIdParamSchema>;

export const locationResourceParamSchema = z.object({
  locationId: z.string().uuid(),
  id: z.string().uuid(),
});

export type LocationResourceParam = z.infer<typeof locationResourceParamSchema>;
