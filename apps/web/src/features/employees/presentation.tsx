"use client";

import {
  ORG_ROLE,
  requiresLocationAssignments,
  type EmployeeResponse,
} from "@haccp/shared";
import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { displayName, initials, statusVariant } from "./utils";

/**
 * The four things an employee renders as, wherever it is rendered.
 *
 * The desktop table and the mobile card show the same facts in different
 * layouts, and were written twice — which had already drifted (locations chips
 * were `secondary` in one and `outline` in the other) and forced every rule
 * change to be applied in both places. The layouts stay separate; only what a
 * status or a set of locations *looks like* lives here.
 */

export function EmployeeAvatar({
  employee,
  size = "sm",
}: {
  employee: EmployeeResponse;
  size?: "sm" | "md";
}) {
  const name = displayName(employee);

  return (
    <Avatar className={size === "md" ? "size-10" : "size-8"}>
      {employee.user?.hasImage ? (
        <AvatarImage src={employee.user.imageUrl} alt={name} />
      ) : null}
      <AvatarFallback>{initials(employee)}</AvatarFallback>
    </Avatar>
  );
}

export function EmployeeIdentity({
  employee,
  size = "sm",
}: {
  employee: EmployeeResponse;
  size?: "sm" | "md";
}) {
  const name = displayName(employee);

  return (
    <div className="flex items-center gap-3">
      <EmployeeAvatar employee={employee} size={size} />
      <div className="min-w-0">
        <div
          className={cn(
            "truncate font-medium",
            size === "md" && "text-base leading-tight",
          )}
        >
          {name}
        </div>
        <div
          className={cn(
            "truncate text-muted-foreground",
            size === "md" ? "text-sm" : "text-xs",
          )}
        >
          {employee.email}
        </div>
      </div>
    </div>
  );
}

export function EmployeeStatusBadge({
  employee,
}: {
  employee: EmployeeResponse;
}) {
  const t = useTranslations("EmployeesPage");

  return (
    <Badge variant={statusVariant(employee.status)}>
      {t(`status.${employee.status}`)}
    </Badge>
  );
}

export function EmployeeRoleBadge({
  employee,
}: {
  employee: EmployeeResponse;
}) {
  const t = useTranslations("EmployeesPage");

  return (
    <Badge variant="outline">
      {employee.role === ORG_ROLE.ADMIN ? t("roles.admin") : t("roles.member")}
    </Badge>
  );
}

/**
 * An admin reaches every location, so it reads "all locations" rather than
 * listing them — the assignment list is genuinely empty for admins, and showing
 * "none" would be actively misleading.
 */
export function EmployeeLocationsBadges({
  employee,
}: {
  employee: EmployeeResponse;
}) {
  const t = useTranslations("EmployeesPage");

  if (!requiresLocationAssignments(employee.role)) {
    return <Badge variant="secondary">{t("allLocations")}</Badge>;
  }

  if (employee.locations.length === 0) {
    return (
      <span className="text-sm text-muted-foreground">{t("noLocations")}</span>
    );
  }

  return (
    <>
      {employee.locations.map((location) => (
        <Badge key={location.id} variant="secondary">
          {location.name}
        </Badge>
      ))}
    </>
  );
}
