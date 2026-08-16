import { cn } from "@/lib/utils";

/** 22px ring centred 22px from block top; segment is top-[33px] / -bottom-[11px] so dashes do not restart mid-gap. */
const RAIL_AXIS_CLASSNAME = "left-[13px] -translate-x-1/2 sm:left-[15px]";

export const RAIL_SEGMENT_CLASSNAME = `absolute top-[33px] -bottom-[11px] ${RAIL_AXIS_CLASSNAME}`;

/** Last segment has no ring to land on, so it fades out. */
export const RAIL_TAIL_SEGMENT_CLASSNAME = `${RAIL_SEGMENT_CLASSNAME} [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]`;

export const RAIL_DOT_CLASSNAME = `absolute top-[22px] -translate-y-1/2 ${RAIL_AXIS_CLASSNAME}`;

/** Repeating gradient: border dashes stretch to fit, so short and tall gaps looked different. */
export const UPCOMING_RAIL_CLASSNAME =
  "w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--color-muted-foreground)_0px_4px,transparent_4px_8px)] opacity-30";

export const RAIL_LEAD_IN_SPACING_CLASSNAME = "pt-3";

const RAIL_LEAD_IN_HEIGHT_CLASSNAME = "h-[23px]";

export function getRailLeadInClassName(): string {
  return cn(
    "absolute top-0",
    RAIL_LEAD_IN_HEIGHT_CLASSNAME,
    RAIL_AXIS_CLASSNAME,
    UPCOMING_RAIL_CLASSNAME,
    "[mask-image:linear-gradient(to_bottom,transparent_0%,black_100%)]",
  );
}
