import { TARGET_KIND, type TargetKind } from "@haccp/shared";
import {
  ComponentIcon,
  DoorOpenIcon,
  RefrigeratorIcon,
  type LucideIcon,
} from "lucide-react";

export const TARGET_KIND_ICONS: Record<TargetKind, LucideIcon> = {
  [TARGET_KIND.EQUIPMENT]: RefrigeratorIcon,
  [TARGET_KIND.AREA]: DoorOpenIcon,
  [TARGET_KIND.COMPONENT]: ComponentIcon,
};
