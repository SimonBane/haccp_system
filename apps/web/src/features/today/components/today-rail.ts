/**
 * Shared geometry for the timeline's vertical rail.
 *
 * Every marker on the axis — a round's dot and the live now-line dot — sits on
 * the same 22px axis point measured from the top of its own block, and every
 * block draws exactly one segment: from its own dot down to the next block's
 * dot (hence the 22px overhang past its own bottom edge). One element per gap
 * is what keeps the dashes reading as a single rail — a segment split at a
 * block boundary restarts its pattern mid-gap, which shows up as a double-length
 * dash just above each dot.
 */
const RAIL_AXIS_CLASSNAME = "left-[13px] -translate-x-1/2 sm:left-[15px]";

export const RAIL_SEGMENT_CLASSNAME = `absolute top-[22px] -bottom-[22px] ${RAIL_AXIS_CLASSNAME}`;

/**
 * The last segment on the axis has no dot to reach, so it stops at its own
 * edge and fades out. The mask fades whatever the segment is — colour or
 * dashes — rather than replacing its background, so the final block still
 * reads as itself.
 */
export const RAIL_TAIL_SEGMENT_CLASSNAME = `absolute top-[22px] bottom-0 ${RAIL_AXIS_CLASSNAME} [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]`;

/** Centres a marker of any size on the axis point. */
export const RAIL_DOT_CLASSNAME = `absolute top-[22px] -translate-y-1/2 ${RAIL_AXIS_CLASSNAME}`;

/**
 * Drawn as a repeating gradient rather than a dashed border: the browser
 * stretches border dashes to fit the segment, so a short gap and a tall one
 * ended up with visibly different dashes. Fixed 4px on, 4px off is identical
 * in every gap.
 */
export const UPCOMING_RAIL_CLASSNAME =
  "w-0.5 bg-[repeating-linear-gradient(to_bottom,var(--color-muted-foreground)_0px_4px,transparent_4px_8px)] opacity-30";
