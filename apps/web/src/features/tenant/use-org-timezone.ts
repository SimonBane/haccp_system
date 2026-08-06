"use client";

import { useTenant } from "@/features/tenant/tenant-provider";

/**
 * The organisation's IANA zone. Scheduled times are wall clocks at the site, so
 * anything deciding what "today", "now" or "overdue" means has to read it here
 * rather than trusting the device.
 */
export function useOrgTimeZone(): string {
  return useTenant().organization.timezone;
}
