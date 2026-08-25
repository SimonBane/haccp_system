export const queryKeys = {
  today: (locationId: string, date: string) =>
    ["today", locationId, date] as const,
  todayByLocation: (locationId: string) => ["today", locationId] as const,
  equipment: (locationId: string) => ["equipment", locationId] as const,
  taskTemplates: (locationId: string) => ["task-templates", locationId] as const,
  /** Invalidation root: covers every cached range, page, sort and filter variant. */
  records: (locationId: string) => ["records", locationId] as const,
  /**
   * The grid controller's key root. The range belongs to the scope, so placeholder
   * rows from the previous range can never render against a new one.
   */
  recordsRange: (locationId: string, dateFrom: string, dateTo: string) =>
    ["records", locationId, "range", dateFrom, dateTo] as const,
  // Org-scoped so switching Clerk org cannot serve the previous org's cache.
  locations: (organizationId: string) => ["locations", organizationId] as const,
  employees: (organizationId: string) => ["employees", organizationId] as const,
};

export function isLocationScopedQueryKey(queryKey: readonly unknown[]): boolean {
  const root = queryKey[0];
  return (
    root === "today" ||
    root === "equipment" ||
    root === "task-templates" ||
    root === "records"
  );
}
