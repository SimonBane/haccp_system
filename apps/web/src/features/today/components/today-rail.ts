/**
 * Shared geometry for the timeline's vertical rail.
 *
 * Every marker on the axis — a round's dot and the live now-line dot — is a
 * ringed dot centred on the same 22px axis point measured from the top of its
 * own block, and every ring has the same 22px outer diameter (11px radius) so
 * a segment can end on the ring without knowing which kind of marker it is
 * running into.
 *
 * Each block draws exactly one segment, from the edge of its own ring down to
 * the edge of the next block's ring: 22 + 11 = 33px below its top, ending 11px
 * past its own bottom edge (the next dot sits 22px below that, less its 11px
 * ring). One element per gap is what keeps the dashes reading as a single
 * rail — a segment split at a block boundary restarts its pattern mid-gap,
 * which shows up as a double-length dash just above each dot.
 */
const RAIL_AXIS_CLASSNAME = "left-[13px] -translate-x-1/2 sm:left-[15px]";

export const RAIL_SEGMENT_CLASSNAME = `absolute top-[33px] -bottom-[11px] ${RAIL_AXIS_CLASSNAME}`;

/**
 * The last segment on the axis has no ring to land on, so it fades out. The
 * mask fades whatever the segment is — colour or dashes — rather than
 * replacing its background, so the final block still reads as itself.
 */
export const RAIL_TAIL_SEGMENT_CLASSNAME = `${RAIL_SEGMENT_CLASSNAME} [mask-image:linear-gradient(to_bottom,black_55%,transparent_100%)]`;

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
