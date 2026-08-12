import { zonedDateString } from "@haccp/shared";
import { type Locale } from "@/i18n/routing";
import {
  getTenantContext,
  getToday,
  resolveActiveLocationId,
} from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { TodayView } from "@/features/today/today-view";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const today = await getToday(
    locationId,
    zonedDateString(new Date(), tenant.organization.timezone),
  );

  return (
    <div className="flex flex-1 flex-col">
      <TodayView
        initialData={today}
        initialDate={today.date}
        initialLocationId={locationId}
      />
    </div>
  );
}
