"use client";

import { useAuth } from "@clerk/nextjs";
import { Loader2Icon } from "lucide-react";
import type { ReactNode } from "react";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { isLoaded } = useAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
