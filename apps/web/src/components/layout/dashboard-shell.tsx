"use client";

import { useAuth } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { FullPageLoader } from "@/components/layout/full-page-loader";
import { MobileTopBar } from "@/components/layout/mobile-top-bar";
import { ShellSlotProvider } from "@/components/layout/shell-slots";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LocationQuerySync } from "@/features/tenant/location-query-sync";

function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <ShellSlotProvider>
      <LocationQuerySync />
      <AppSidebar />
      <SidebarInset>
        <MobileTopBar />
        {children}
      </SidebarInset>
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
