"use client";

import { useTenant } from "@/features/tenant/tenant-provider";

/** Site wall-clock zone — not the device's. */
export function useOrgTimeZone(): string {
  return useTenant().organization.timezone;
}
