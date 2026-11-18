import { type Locale } from "@/i18n/routing";
import {
  getTenantContext,
  listTargets,
  listTargetTypes,
  resolveActiveLocationId,
} from "@/lib/api-client";
import { setRequestLocale } from "next-intl/server";
import { PageContainer } from "@/components/layout/page-container";
import { TargetsManager } from "@/features/targets/targets-manager";

export default async function TargetsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale as Locale);

  const tenant = await getTenantContext();
  const locationId = await resolveActiveLocationId(tenant);
  const [targets, targetTypes] = await Promise.all([
    listTargets(locationId),
    listTargetTypes(),
  ]);

  return (
    <PageContainer width="content">
      <TargetsManager
        initialItems={targets.items}
        initialTypes={targetTypes.items}
        initialLocationId={locationId}
      />
    </PageContainer>
  );
}
