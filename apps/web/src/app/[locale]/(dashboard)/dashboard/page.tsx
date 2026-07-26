import { type Locale } from "@/i18n/routing";
import { getToday } from "@/lib/api-client";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DashboardPageHeader } from "@/components/layout/dashboard-page-header";
import { TodayView } from "@/features/today/today-view";

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tDashboard = await getTranslations("DashboardPage");
  const tToday = await getTranslations("TodayPage");

  const today = await getToday();

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={[
          { label: tDashboard("breadcrumbDashboard") },
          { label: tToday("breadcrumb"), current: true },
        ]}
      />
      <div className="flex flex-1 flex-col">
        <TodayView initialData={today} initialDate={today.date} />
      </div>
    </>
  );
}
