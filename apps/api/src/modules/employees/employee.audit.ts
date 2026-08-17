import type { OrgRole } from "@haccp/shared";
import { logger } from "../../lib/logger.js";

// The only durable trace of a role change today — HACCP-56 §8's non-goal excludes
// a role-change journal/table, so this fixed field set through the app logger is it.
type RoleChangeStage =
  | "applied"
  | "rejected"
  | "outcome_unknown"
  | "projection_failed";

export function logRoleChange(fields: {
  stage: RoleChangeStage;
  actorUserDbId: string;
  actorClerkUserId: string;
  organizationId: string;
  membershipId: string;
  targetClerkUserId: string | null;
  previousRole: OrgRole;
  requestedRole: OrgRole;
  authoritativeRole?: OrgRole;
}): void {
  logger.info({ event: "role_change", ...fields }, `Role change ${fields.stage}`);
}
