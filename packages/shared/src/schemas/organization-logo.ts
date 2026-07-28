export const ORGANIZATION_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const ORGANIZATION_LOGO_ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
] as const;

export const ORGANIZATION_LOGO_ACCEPT = ".jpg,.jpeg,.png,.gif,.webp";

export type OrganizationLogoValidationError = "invalid_type" | "too_large";

export function validateOrganizationLogoFile(file: {
  size: number;
  type: string;
}): OrganizationLogoValidationError | null {
  if (
    !ORGANIZATION_LOGO_ACCEPTED_TYPES.includes(
      file.type as (typeof ORGANIZATION_LOGO_ACCEPTED_TYPES)[number],
    )
  ) {
    return "invalid_type";
  }

  if (file.size > ORGANIZATION_LOGO_MAX_BYTES) {
    return "too_large";
  }

  return null;
}
