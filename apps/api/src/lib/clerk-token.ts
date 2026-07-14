type ClerkOrgClaim = {
  id?: string;
  rol?: string;
};

export function extractOrgIdFromPayload(
  payload: Record<string, unknown>,
): string | null {
  if (typeof payload.org_id === "string") {
    return payload.org_id;
  }

  const org = payload.o as ClerkOrgClaim | undefined;
  if (org && typeof org.id === "string") {
    return org.id;
  }

  return null;
}

export function extractOrgRoleFromPayload(
  payload: Record<string, unknown>,
): string | null {
  if (typeof payload.org_role === "string") {
    return payload.org_role;
  }

  const org = payload.o as ClerkOrgClaim | undefined;
  if (org && typeof org.rol === "string") {
    return org.rol.startsWith("org:") ? org.rol : `org:${org.rol}`;
  }

  return null;
}
