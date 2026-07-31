import {
  Building2Icon,
  CalendarDaysIcon,
  ListChecksIcon,
  MoreHorizontalIcon,
  ThermometerSnowflakeIcon,
  type LucideIcon,
} from "lucide-react";

export type NavSubItem = {
  title: string;
  url: string;
  isActive: boolean;
};

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  isActive: boolean;
  items?: NavSubItem[];
};

export type MobileBottomTab = {
  key: string;
  title: string;
  url?: string;
  icon: LucideIcon;
  isActive: boolean;
  opensMore?: boolean;
};

type NavLabels = {
  today: string;
  organization: string;
  tasks: string;
  equipment: string;
  locations: string;
  employees: string;
  more: string;
};

export function isOrganizationPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/organization" ||
    pathname.startsWith("/dashboard/organization/")
  );
}

export function getPlatformNavItems(
  pathname: string,
  labels: Pick<NavLabels, "today">,
): NavItem[] {
  return [
    {
      title: labels.today,
      url: "/dashboard",
      icon: CalendarDaysIcon,
      isActive: pathname === "/dashboard",
    },
  ];
}

export function getAdminNavItems(
  pathname: string,
  labels: NavLabels,
  multipleLocationsEnabled: boolean,
): NavItem[] {
  const organizationNav: NavItem = {
    title: labels.organization,
    url: "/dashboard/organization",
    icon: Building2Icon,
    isActive: isOrganizationPath(pathname),
    items: [
      {
        title: labels.employees,
        url: "/dashboard/organization/employees",
        isActive: pathname.startsWith("/dashboard/organization/employees"),
      },
      ...(multipleLocationsEnabled
        ? [
            {
              title: labels.locations,
              url: "/dashboard/organization/locations",
              isActive: pathname.startsWith(
                "/dashboard/organization/locations",
              ),
            },
          ]
        : []),
    ],
  };

  return [
    organizationNav,
    {
      title: labels.tasks,
      url: "/dashboard/task-templates",
      icon: ListChecksIcon,
      isActive: pathname.startsWith("/dashboard/task-templates"),
    },
    {
      title: labels.equipment,
      url: "/dashboard/equipment",
      icon: ThermometerSnowflakeIcon,
      isActive: pathname.startsWith("/dashboard/equipment"),
    },
  ];
}

export function getMobileAdminTabs(
  pathname: string,
  labels: Pick<NavLabels, "today" | "tasks" | "equipment" | "more">,
): MobileBottomTab[] {
  return [
    {
      key: "today",
      title: labels.today,
      url: "/dashboard",
      icon: CalendarDaysIcon,
      isActive: pathname === "/dashboard",
    },
    {
      key: "equipment",
      title: labels.equipment,
      url: "/dashboard/equipment",
      icon: ThermometerSnowflakeIcon,
      isActive: pathname.startsWith("/dashboard/equipment"),
    },
    {
      key: "tasks",
      title: labels.tasks,
      url: "/dashboard/task-templates",
      icon: ListChecksIcon,
      isActive: pathname.startsWith("/dashboard/task-templates"),
    },
    {
      key: "more",
      title: labels.more,
      icon: MoreHorizontalIcon,
      isActive: isOrganizationPath(pathname),
      opensMore: true,
    },
  ];
}

export function getMoreSheetNavItems(
  pathname: string,
  labels: Pick<NavLabels, "organization" | "employees" | "locations">,
  multipleLocationsEnabled: boolean,
): NavSubItem[] {
  return [
    {
      title: labels.organization,
      url: "/dashboard/organization",
      isActive: pathname === "/dashboard/organization",
    },
    {
      title: labels.employees,
      url: "/dashboard/organization/employees",
      isActive: pathname.startsWith("/dashboard/organization/employees"),
    },
    ...(multipleLocationsEnabled
      ? [
          {
            title: labels.locations,
            url: "/dashboard/organization/locations",
            isActive: pathname.startsWith("/dashboard/organization/locations"),
          },
        ]
      : []),
  ];
}
