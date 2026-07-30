import { z } from "zod";

export const userSummarySchema = z.object({
  id: z.string().uuid(),
  firstName: z.string(),
  lastName: z.string(),
});

export type UserSummary = z.infer<typeof userSummarySchema>;

export const userResponseSchema = z.object({
  id: z.string().uuid(),
  clerkUserId: z.string().nullable(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  imageUrl: z.string(),
  hasImage: z.boolean(),
});

export type UserResponse = z.infer<typeof userResponseSchema>;
