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
};

export function DashboardPageHeader({ breadcrumbs }: DashboardPageHeaderProps) {
  const isMobile = useIsMobile();
  const { orgRole } = useAuth();
  const isAdmin = orgRole === ORG_ROLE.ADMIN;
  const showMemberMenu = isMobile && !isAdmin;

  return (
    <header
      className={cn(
        "flex shrink-0 flex-col gap-2 pt-[env(safe-area-inset-top)] md:h-16 md:flex-row md:items-center md:gap-2 md:pt-0",
      )}
    >
      <div className="flex min-h-14 flex-1 items-center gap-2 px-4 md:min-h-0">
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
      <div className="flex items-center gap-2 px-4 pb-2 md:pb-0 md:pr-4">
        {showMemberMenu ? <HeaderUserMenu /> : null}
        <LocationPickerSlot />
      </div>
    </header>
  );
}
