import { z } from "zod";

/**
 * Field primitives shared between the API's request schemas and the web app's
 * form schemas.
 *
 * The two are deliberately *not* the same schema — a form needs an unselected
 * initial state the API must reject, and some rules depend on tenant flags the
 * API does not have. But the field constraints themselves must not drift: a
 * form that allows 120 characters against an API that caps at 100 fails at
 * submit, after the work is typed. Composing both sides from these keeps the
 * bounds in one place while leaving the rules free to differ.
 */

/** 256 is the practical RFC 5321 ceiling for a full address. */
export const trimmedEmailSchema = z.string().trim().max(256).pipe(z.email());

/** A required person name. */
export const personNameSchema = z.string().trim().min(1).max(100);

/** A person name that may be cleared. */
export const optionalPersonNameSchema = z.string().trim().max(100);

export const locationIdsSchema = z.array(z.uuid());
