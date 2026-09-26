import { currentUser } from "@clerk/nextjs/server";
import { zonedDateString, type RecordsReportResponse } from "@haccp/shared";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRecordsReport, getTenantContext } from "@/lib/api-client";
import { requireOrgAdmin } from "@/lib/auth/require-org-admin";
import { ReportNotice } from "@/features/records-report/components/report-notice";
import {
  parseReportSearchParams,
  reportApiQuery,
} from "@/features/records-report/lib/report-search-params";
import { RecordsReport } from "@/features/records-report/records-report";
import { hasMultipleLocations } from "@/features/tenant/lib/multiple-locations";
import type { Locale } from "@/i18n/routing";

const BACK_HREF = "/dashboard/records";

export const metadata = {
  robots: { index: false, follow: false },
};

type ReportPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Deliberately outside /dashboard: the print document must not carry the sidebar or the
 * mobile chrome, which also means this page owns its own admin gate.
 */
export default async function RecordsPrintReportPage({
  params,
  searchParams,
}: ReportPageProps) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  await requireOrgAdmin();

  const [tenant, query, t] = await Promise.all([
    getTenantContext(),
    searchParams,
    getTranslations("RecordsReportPage"),
  ]);

  // Server renders run in UTC on Vercel, so "today" must come from the org zone.
  const parsed = parseReportSearchParams({
    searchParams: query,
    locationIds: tenant.locations.map((location) => location.id),
    today: zonedDateString(new Date(), tenant.organization.timezone),
  });

  if (!parsed.ok) {
    return (
      <ReportNotice
        title={t("invalid.title")}
        description={t("invalid.description")}
        backLabel={t("invalid.back")}
        backHref={BACK_HREF}
      />
    );
  }

  let report: RecordsReportResponse;
  try {
    report = await getRecordsReport(
      parsed.params.locationId,
      reportApiQuery(parsed.params),
    );
  } catch {
    return (
      <ReportNotice
        title={t("error.title")}
        description={t("error.description")}
        backLabel={t("error.back")}
        backHref={BACK_HREF}
      />
    );
  }

  const location = tenant.locations.find(
    (candidate) => candidate.id === parsed.params.locationId,
  )!;

  const user = await currentUser();

  return (
    <RecordsReport
      report={report}
      params={parsed.params}
      organizationName={tenant.organization.name}
      locationName={
        hasMultipleLocations(tenant.organization, tenant.locations)
          ? location.name
          : null
      }
      generatedBy={reportAuthor(user)}
      locale={locale}
      timeZone={tenant.organization.timezone}
      backHref={BACK_HREF}
    />
  );
}

function reportAuthor(
  user: Awaited<ReturnType<typeof currentUser>>,
): string | null {
  if (!user) return null;

  const name = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return name === "" ? null : name;
}
