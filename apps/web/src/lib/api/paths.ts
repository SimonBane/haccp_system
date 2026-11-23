export function locationScopedPath(
  locationId: string,
  resource:
    | "targets"
    | "records"
    | "task-templates"
    | "today"
    | "today/occurrences"
    | "today/records"
    | "today/forms",
  suffix = "",
): string {
  return `/locations/${locationId}/${resource}${suffix}`;
}
