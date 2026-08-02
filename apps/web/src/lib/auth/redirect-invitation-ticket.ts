import { type Locale } from "@/i18n/routing";
import { getClerkLocalePath } from "@/lib/clerk-localization";

export function getAcceptInvitationRedirectUrl(
  locale: Locale,
  searchParams: Record<string, string | string[] | undefined>,
): string | null {
  const clerkTicket = searchParams.__clerk_ticket;

  if (typeof clerkTicket !== "string" || clerkTicket.length === 0) {
    return null;
  }

  const queryString = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) =>
      value === undefined
        ? []
        : Array.isArray(value)
          ? value.map((entry) => [key, entry])
          : [[key, value]],
    ),
  ).toString();

  const acceptPath = getClerkLocalePath(locale, "/accept-invitation");
  return queryString ? `${acceptPath}?${queryString}` : acceptPath;
}
