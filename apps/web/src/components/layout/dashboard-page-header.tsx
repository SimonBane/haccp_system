import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

type BreadcrumbEntry = {
  label: string;
  current?: boolean;
};

type DashboardPageHeaderProps = {
  breadcrumbs: BreadcrumbEntry[];
};

export function DashboardPageHeader({ breadcrumbs }: DashboardPageHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-vertical:h-4 data-vertical:self-auto"
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
  );
}
