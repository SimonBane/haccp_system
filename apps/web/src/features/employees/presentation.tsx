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

/** Admin assignment is empty on purpose — listing "none" would be wrong. */
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
