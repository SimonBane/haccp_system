import { defaultRecordsDateRange, zonedDateString } from "@haccp/shared";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { RecordsView } from "@/features/records/records-view";
import { defaultRecordsQueryString } from "@/features/records/lib/records-grid-config";
import { type Locale } from "@/i18n/routing";
import {
  getRecordsPage,
  getTenantContext,
  resolveActiveLocationId,
} from "@/lib/api-client";

export default async function RecordsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  // Server renders run in UTC on Vercel, so "today" must come from the org zone.
  const today = zonedDateString(new Date(), tenant.organization.timezone);
  const range = defaultRecordsDateRange(today);
  const initialPage = await getRecordsPage(
    locationId,
    defaultRecordsQueryString(range),
  );

  return (
    <PageContainer width="content">
      <RecordsView
        initialPage={initialPage}
        initialLocationId={locationId}
        initialRange={range}
        today={today}
      />
    </PageContainer>
  );
}
