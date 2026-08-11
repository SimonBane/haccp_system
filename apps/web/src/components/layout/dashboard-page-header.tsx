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
import { Link } from "@/i18n/navigation";

type BreadcrumbEntry = {
  label: string;
  href?: string;
  current?: boolean;
};

type DashboardPageHeaderProps = {
  breadcrumbs: BreadcrumbEntry[];
};

/**
 * The desktop breadcrumb bar, and only that. The mobile title belongs to
 * `PageHeader`, which is the one component that knows the page's real title
 * rather than the last crumb standing in for it.
 */
export function DashboardPageHeader({
  breadcrumbs,
}: DashboardPageHeaderProps) {
  return (
    <>
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
