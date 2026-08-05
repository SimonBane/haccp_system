import {
  Building2Icon,
  CalendarDaysIcon,
  ListChecksIcon,
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
  defaultExpanded?: boolean;
  items?: NavSubItem[];
};

type NavLabels = {
  today: string;
  organization: string;
  tasks: string;
  equipment: string;
  locations: string;
  employees: string;
};

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
    isActive: pathname === "/dashboard/organization",
    defaultExpanded: true,
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
