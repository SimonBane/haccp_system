"use client";

import { useAuth } from "@clerk/nextjs";
import { useCallback, type ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { MobileHeaderSlotProvider } from "@/components/layout/mobile-header-slot";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import {
  SidebarInset,
  SidebarProvider,
  useSidebar,
} from "@/components/ui/sidebar";
import { LocationQuerySync } from "@/features/tenant/location-query-sync";
import { useSwipeOpen } from "@/hooks/use-drawer-swipe";

function DashboardLayout({ children }: { children: ReactNode }) {
  const { isMobile, openMobile, setOpenMobile } = useSidebar();
  const openDrawer = useCallback(() => setOpenMobile(true), [setOpenMobile]);

  useSwipeOpen({ enabled: isMobile && !openMobile, onOpen: openDrawer });

  return (
    <MobileHeaderSlotProvider>
      <LocationQuerySync />
      <AppSidebar />
      <SidebarInset className="max-md:touch-pan-y max-md:overscroll-x-none">
        <MobileTopBar />
        {children}
      </SidebarInset>
    </MobileHeaderSlotProvider>
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
