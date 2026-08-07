import { z } from "zod";

export const uuidParamSchema = z.object({
  id: z.uuid(),
});

export type UuidParam = z.infer<typeof uuidParamSchema>;

export const locationIdParamSchema = z.object({
  locationId: z.uuid(),
});

export type LocationIdParam = z.infer<typeof locationIdParamSchema>;

export const locationResourceParamSchema = z.object({
  locationId: z.uuid(),
  id: z.uuid(),
});

export type LocationResourceParam = z.infer<typeof locationResourceParamSchema>;
