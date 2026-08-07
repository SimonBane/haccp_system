"use client";

import { PanelLeftIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useSidebar } from "@/components/ui/sidebar";
import { useMobileHeaderSlotRef } from "@/components/layout/mobile-header-slot";
import { useIsMobile } from "@/hooks/use-mobile";

export function MobileTopBar() {
  const t = useTranslations("Sidebar");
  const isMobile = useIsMobile();
  const { toggleSidebar } = useSidebar();
  const titleRef = useMobileHeaderSlotRef("title");
  const centerRef = useMobileHeaderSlotRef("center");
  const actionsRef = useMobileHeaderSlotRef("actions");

  // Kept out of the desktop tree entirely so pages can render their slot
  // content unconditionally without it landing in a hidden duplicate bar.
  if (!isMobile) {
    return null;
  }

  return (
    <header className="sticky top-0 z-40 bg-background pt-[var(--safe-area-inset-top,env(safe-area-inset-top,0px))] md:hidden">
      <div className="flex h-14 items-center gap-1 px-2">
        <Button
          variant="outline"
          size="icon-lg"
          className="shrink-0 rounded-lg border-sidebar-border bg-transparent text-foreground shadow-none hover:bg-transparent"
          aria-label={t("openNav")}
          onClick={toggleSidebar}
        >
          <PanelLeftIcon className="size-5" />
        </Button>

        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
          <div
            ref={titleRef}
            className="min-w-0 truncate text-center text-base font-semibold tracking-tight"
          />
          <div ref={centerRef} className="flex shrink-0 items-center gap-1.5" />
        </div>

        <div
          ref={actionsRef}
          className="flex w-10 shrink-0 items-center justify-end gap-1"
        />
      </div>
    </header>
  );
}
