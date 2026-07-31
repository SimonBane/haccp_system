"use client";

import { ORG_ROLE } from "@haccp/shared";
import { useAuth } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { LocationQuerySync } from "@/features/tenant/location-query-sync";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isLoaded, orgRole } = useAuth();
  const isMobile = useIsMobile();
  const isAdmin = orgRole === ORG_ROLE.ADMIN;
  const showBottomNav = isMobile && isAdmin;

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <LocationQuerySync />
      {!isMobile ? <AppSidebar /> : null}
      <SidebarInset
        className={cn(
          showBottomNav &&
            "pb-[calc(4rem+env(safe-area-inset-bottom))]",
        )}
      >
        {children}
      </SidebarInset>
      <MobileBottomNav />
    </SidebarProvider>
  );
}
