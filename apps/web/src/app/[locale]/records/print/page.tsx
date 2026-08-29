import { currentUser } from "@clerk/nextjs/server";
import {
  RECORDS_RESULT_FILTER_VALUES,
  RECORDS_STATE_FILTER_VALUES,
  RECORDS_TYPE_FILTER_VALUES,
  zonedDateString,
  type RecordsReportResponse,
} from "@haccp/shared";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getRecordsReport, getTenantContext } from "@/lib/api-client";
import { requireOrgAdmin } from "@/lib/auth/require-org-admin";
import { ReportNotice } from "@/features/records-report/components/report-notice";
import {
  parseReportSearchParams,
  reportApiQuery,
} from "@/features/records-report/lib/report-search-params";
import type { RecordsFilterLabels } from "@/features/records/lib/records-filters";
import { RecordsReport } from "@/features/records-report/records-report";
import type { Locale } from "@/i18n/routing";

const BACK_HREF = "/dashboard/records";

const RESULT_LABEL_KEY = {
  pass: "pass",
  fail: "fail",
  not_evaluated: "notEvaluated",
} as const;

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

  const [tenant, query, t, filterT] = await Promise.all([
    getTenantContext(),
    searchParams,
    getTranslations("RecordsReportPage"),
    getTranslations("RecordsPage"),
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

  const filterLabels: RecordsFilterLabels = {
    type: filterT("filters.type"),
    state: filterT("filters.state"),
    result: filterT("filters.result"),
    typeOptions: Object.fromEntries(
      RECORDS_TYPE_FILTER_VALUES.map((value) => [
        value,
        filterT(`types.${value}`),
      ]),
    ) as RecordsFilterLabels["typeOptions"],
    stateOptions: Object.fromEntries(
      RECORDS_STATE_FILTER_VALUES.map((value) => [
        value,
        filterT(`displayState.${value}`),
      ]),
    ) as RecordsFilterLabels["stateOptions"],
    resultOptions: Object.fromEntries(
      RECORDS_RESULT_FILTER_VALUES.map((value) => [
        value,
        filterT(`result.${RESULT_LABEL_KEY[value]}`),
      ]),
    ) as RecordsFilterLabels["resultOptions"],
  };

  return (
    <RecordsReport
      report={report}
      params={parsed.params}
      organizationName={tenant.organization.name}
      locationName={location.name}
      generatedBy={reportAuthor(user)}
      filterLabels={filterLabels}
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
  const email = user.primaryEmailAddress?.emailAddress ?? null;

  if (name !== "" && email !== null) return `${name} (${email})`;
  return name !== "" ? name : email;
}
