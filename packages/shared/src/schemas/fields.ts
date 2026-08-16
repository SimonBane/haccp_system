import { z } from "zod";

/** 256 is the practical RFC 5321 ceiling for a full address. */
export const trimmedEmailSchema = z.string().trim().max(256).pipe(z.email());

export const personNameSchema = z.string().trim().min(1).max(100);

export const optionalPersonNameSchema = z.string().trim().max(100);

export const locationIdsSchema = z.array(z.uuid());
