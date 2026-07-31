"use client";

import { useTranslations } from "next-intl";
import { Building2Icon } from "lucide-react";
import { Link, usePathname } from "@/i18n/navigation";
import { useTenant } from "@/features/tenant/tenant-provider";
import { buttonVariants } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getMoreSheetNavItems } from "@/components/layout/nav-config";
import { UserMenuSheetItems } from "@/components/layout/user-menu-items";
import { cn } from "@/lib/utils";

type MobileMoreSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function MobileMoreSheet({ open, onOpenChange }: MobileMoreSheetProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { organization } = useTenant();

  const navItems = getMoreSheetNavItems(
    pathname,
    {
      organization: t("nav.organization"),
      employees: t("nav.employees"),
      locations: t("nav.locations"),
    },
    organization.multipleLocationsEnabled,
  );

  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[85dvh] overflow-y-auto rounded-t-xl pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle>{t("nav.more")}</SheetTitle>
          <SheetDescription className="sr-only">
            {t("nav.organization")}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-1 px-1">
          {navItems.map((item) => (
            <Link
              key={item.url}
              href={item.url}
              onClick={close}
              className={cn(
                buttonVariants({
                  variant: item.isActive ? "secondary" : "ghost",
                }),
                "h-11 w-full justify-start",
              )}
            >
              <Building2Icon className="size-4" />
              {item.title}
            </Link>
          ))}
        </div>

        <Separator className="my-4" />

        <div className="px-1 pb-2">
          <UserMenuSheetItems onNavigate={close} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
