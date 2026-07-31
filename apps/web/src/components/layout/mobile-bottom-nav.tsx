"use client";

import { ORG_ROLE } from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link, usePathname } from "@/i18n/navigation";
import { useIsMobile } from "@/hooks/use-mobile";
import { getMobileAdminTabs } from "@/components/layout/nav-config";
import { MobileMoreSheet } from "@/components/layout/mobile-more-sheet";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const t = useTranslations("Sidebar.nav");
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const { orgRole } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isAdmin = orgRole === ORG_ROLE.ADMIN;

  if (!isMobile || !isAdmin) {
    return null;
  }

  const tabs = getMobileAdminTabs(pathname, {
    today: t("today"),
    tasks: t("tasks"),
    equipment: t("equipment"),
    more: t("more"),
  });

  return (
    <>
      <nav
        aria-label={t("more")}
        className="fixed inset-x-0 bottom-0 z-50 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-4">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const content = (
              <>
                <Icon className="size-5 shrink-0" aria-hidden />
                <span className="truncate text-[10px] leading-tight font-medium">
                  {tab.title}
                </span>
              </>
            );

            const className = cn(
              "flex min-w-0 flex-col items-center justify-center gap-0.5 px-1 text-muted-foreground transition-colors",
              tab.isActive && "text-primary",
            );

            if (tab.opensMore) {
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={className}
                  aria-current={tab.isActive ? "page" : undefined}
                  onClick={() => setMoreOpen(true)}
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={tab.key}
                href={tab.url!}
                className={className}
                aria-current={tab.isActive ? "page" : undefined}
              >
                {content}
              </Link>
            );
          })}
        </div>
      </nav>

      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  );
}
