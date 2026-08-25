export function locationScopedPath(
  locationId: string,
  resource: "equipment" | "records" | "task-templates" | "today" | "today/occurrences",
  suffix = "",
): string {
  return `/locations/${locationId}/${resource}${suffix}`;
}
