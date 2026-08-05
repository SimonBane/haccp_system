"use client";

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
import { MobileHeaderTitle } from "@/components/layout/mobile-header-slot";
import { Link } from "@/i18n/navigation";

type BreadcrumbEntry = {
  label: string;
  href?: string;
  current?: boolean;
};

type DashboardPageHeaderProps = {
  breadcrumbs: BreadcrumbEntry[];
  /** Pages that render their own title bar (Today) skip the mobile title. */
  compact?: boolean;
};

export function DashboardPageHeader({
  breadcrumbs,
  compact = false,
}: DashboardPageHeaderProps) {
  const pageTitle = breadcrumbs.at(-1)?.label;

  return (
    <>
      {!compact && pageTitle ? (
        <MobileHeaderTitle>{pageTitle}</MobileHeaderTitle>
      ) : null}

      {!compact ? (
        <div className="h-1 shrink-0 md:hidden" aria-hidden />
      ) : null}

      {/* Desktop breadcrumb bar; mobile title lives in the shared top bar. */}
      <header className="hidden shrink-0 flex-col gap-2 md:flex md:h-16 md:flex-row md:items-center md:gap-2">
        <div className="hidden min-h-14 flex-1 items-center gap-2 px-4 md:flex md:min-h-0">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-vertical:h-4 data-vertical:self-auto"
          />
          <Breadcrumb>
            <BreadcrumbList>
              {breadcrumbs.map((entry, index) => (
                <span key={`${entry.label}-${index}`} className="contents">
                  {index > 0 ? <BreadcrumbSeparator /> : null}
                  <BreadcrumbItem>
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
      </header>
    </>
  );
}
