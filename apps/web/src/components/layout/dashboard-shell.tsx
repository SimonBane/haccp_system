"use client";

import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { MobileHeaderSlotProvider } from "@/components/layout/mobile-header-slot";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LocationQuerySync } from "@/features/tenant/location-query-sync";

function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <MobileHeaderSlotProvider>
      <LocationQuerySync />
      <AppSidebar />
      <SidebarInset className="max-md:touch-pan-y max-md:overscroll-x-none max-md:pb-[var(--safe-area-inset-bottom,env(safe-area-inset-bottom,0px))]">
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
