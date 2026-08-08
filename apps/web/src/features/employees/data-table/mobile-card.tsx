"use client";

import {
  ORG_ROLE,
  requiresLocationAssignments,
  type EmployeeResponse,
} from "@haccp/shared";
import type { Row } from "@tanstack/react-table";
import type { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmployeesTableRowActions } from "@/features/employees/data-table/row-actions";
import { displayName, initials, statusVariant } from "@/features/employees/utils";

type EmployeesTranslations = ReturnType<
  typeof useTranslations<"EmployeesPage">
>;

type EmployeesMobileCardProps = {
  row: Row<EmployeeResponse>;
  t: EmployeesTranslations;
  onEdit: (employee: EmployeeResponse) => void;
  onInvite: (employee: EmployeeResponse) => void;
  onRevokeInvitation: (employee: EmployeeResponse) => void;
  onDelete: (employee: EmployeeResponse) => void;
};

export function EmployeesMobileCard({
  row,
  t,
  onEdit,
  onInvite,
  onRevokeInvitation,
  onDelete,
}: EmployeesMobileCardProps) {
  const employee = row.original;

  return (
    <Card className="py-4">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <Avatar className="size-10">
            {employee.user?.hasImage ? (
              <AvatarImage
                src={employee.user.imageUrl}
                alt={displayName(employee)}
              />
            ) : null}
            <AvatarFallback>{initials(employee)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {displayName(employee)}
            </CardTitle>
            <p className="truncate text-sm text-muted-foreground">
              {employee.email}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        <Badge variant={statusVariant(employee.status)}>
          {t(`status.${employee.status}`)}
        </Badge>
        <Badge variant="outline">
          {employee.role === ORG_ROLE.ADMIN
            ? t("roles.admin")
            : t("roles.member")}
        </Badge>
        {!requiresLocationAssignments(employee.role) ? (
          <Badge variant="outline">{t("allLocations")}</Badge>
        ) : employee.locations.length > 0 ? (
          employee.locations.map((location) => (
            <Badge key={location.id} variant="outline">
              {location.name}
            </Badge>
          ))
        ) : (
          <span className="text-sm text-muted-foreground">{t("noLocations")}</span>
        )}
      </CardContent>
      <CardFooter className="justify-end border-t pt-3">
        <EmployeesTableRowActions
          row={row}
          t={t}
          onEdit={onEdit}
          onInvite={onInvite}
          onRevokeInvitation={onRevokeInvitation}
          onDelete={onDelete}
        />
      </CardFooter>
    </Card>
  );
}
