"use client";

import { ORG_ROLE } from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { HeaderUserMenu } from "@/components/layout/header-user-menu";
import { LocationPickerSlot } from "@/features/tenant/location-picker";
import { useTenant } from "@/features/tenant/tenant-provider";
import { useIsMobile } from "@/hooks/use-mobile";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

type BreadcrumbEntry = {
  label: string;
  href?: string;
  current?: boolean;
};

type DashboardPageHeaderProps = {
  breadcrumbs: BreadcrumbEntry[];
  compact?: boolean;
};

export function DashboardPageHeader({
  breadcrumbs,
  compact = false,
}: DashboardPageHeaderProps) {
  const isMobile = useIsMobile();
  const { orgRole } = useAuth();
  const { organization, locations } = useTenant();
  const isAdmin = orgRole === ORG_ROLE.ADMIN;
  const showMemberMenu = isMobile && !isAdmin;
  const showLocationPicker =
    organization.multipleLocationsEnabled && locations.length > 1;
  const showMobileToolbar = showMemberMenu || showLocationPicker;
  const compactMobile = compact && isMobile;

  if (compactMobile && !showMobileToolbar) {
    return (
      <header
        aria-hidden
        className="shrink-0 pt-[env(safe-area-inset-top)] md:hidden"
      />
    );
  }

  return (
    <header
      className={cn(
        "flex shrink-0 flex-col pt-[env(safe-area-inset-top)] md:h-16 md:flex-row md:items-center md:gap-2 md:pt-0",
        compactMobile ? "gap-0" : "gap-2",
      )}
    >
      <div
        className={cn(
          "flex min-h-14 flex-1 items-center gap-2 px-4 md:min-h-0",
          compact && "hidden md:flex",
        )}
      >
        <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
        <Separator
          orientation="vertical"
          className="mr-2 hidden data-vertical:h-4 data-vertical:self-auto md:block"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {breadcrumbs.map((entry, index) => (
              <span key={`${entry.label}-${index}`} className="contents">
                {index > 0 ? (
                  <BreadcrumbSeparator className="hidden md:block" />
                ) : null}
                <BreadcrumbItem
                  className={index === 0 ? "hidden md:block" : undefined}
                >
                  {entry.current ? (
                    <BreadcrumbPage>{entry.label}</BreadcrumbPage>
                  ) : entry.href ? (
                    <BreadcrumbLink render={<Link href={entry.href} />}>
                      {entry.label}
                    </BreadcrumbLink>
                  ) : (
                    <span>{entry.label}</span>
                  )}
                </BreadcrumbItem>
              </span>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div
        className={cn(
          "flex items-center gap-2 px-4 md:pb-0 md:pr-4",
          compactMobile ? "justify-end py-1.5" : "pb-2",
        )}
      >
        {showMemberMenu ? <HeaderUserMenu /> : null}
        <LocationPickerSlot />
      </div>
    </header>
  );
}
