"use client";

import { useAuth } from "@clerk/nextjs";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import {
  ShellScroll,
  ShellScrollProvider,
} from "@/components/layout/shell-scroll";
import {
  ShellOverlaySlot,
  ShellSlotProvider,
} from "@/components/layout/shell-slots";
import {
  SidebarInset,
  SidebarProvider,
  SidebarScrim,
} from "@/components/ui/sidebar";
import { LocationQuerySync } from "@/features/tenant/location-query-sync";

function DashboardLayout({ children }: { children: ReactNode }) {
  const t = useTranslations("Sidebar");

  return (
    <ShellSlotProvider>
      <ShellScrollProvider>
        <LocationQuerySync />
        <AppSidebar />
        {/*
         * touch-pan-y hands horizontal drags to the drawer gesture. Safe only
         * because no horizontally scrollable region renders on mobile today —
         * `touch-action` intersects up the ancestor chain, so a descendant
         * cannot opt back in. Mark any such region `data-no-swipe`.
         */}
        <SidebarInset className="max-md:touch-pan-y max-md:pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))]">
          <MobileTopBar />
          <ShellScroll>{children}</ShellScroll>
          <ShellOverlaySlot />
        </SidebarInset>
        {/* Sibling of the inset, which goes inert while the drawer is open. */}
        <SidebarScrim label={t("closeNav")} />
      </ShellScrollProvider>
    </ShellSlotProvider>
  );
}

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return <FullPageLoader />;
  }

  return (
    <SidebarProvider>
      <DashboardLayout>{children}</DashboardLayout>
    </SidebarProvider>
  );
}
