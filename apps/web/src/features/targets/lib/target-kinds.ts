import { TARGET_KIND, type TargetKind } from "@haccp/shared";
import {
  BoxIcon,
  BrickWallIcon,
  DoorOpenIcon,
  type LucideIcon,
} from "lucide-react";

export const TARGET_KIND_ICONS: Record<TargetKind, LucideIcon> = {
  [TARGET_KIND.EQUIPMENT]: BoxIcon,
  [TARGET_KIND.AREA]: DoorOpenIcon,
  [TARGET_KIND.FIXTURE]: BrickWallIcon,
};
