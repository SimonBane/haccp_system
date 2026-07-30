import { auth } from "@clerk/nextjs/server";
import { ORG_ROLE } from "@haccp/shared";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { type Locale } from "@/i18n/routing";

export async function requireOrgAdmin() {
  const { orgRole } = await auth();

  if (orgRole !== ORG_ROLE.ADMIN) {
    const locale = (await getLocale()) as Locale;
    redirect({ href: "/forbidden", locale });
  }
}
