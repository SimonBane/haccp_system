export function locationScopedPath(
  locationId: string,
  resource: "equipment" | "task-templates" | "today" | "today/occurrences",
  suffix = "",
): string {
  return `/locations/${locationId}/${resource}${suffix}`;
}
