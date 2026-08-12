import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * How wide a page is, and how far its content sits from the edge.
 *
 * Two tiers rather than one width: prose and forms stop being readable much
 * past ~70 characters a line, while a table with five columns squeezed into
 * the same 768px starts truncating. `full` exists for the rare canvas that
 * really does want the whole inset.
 *
 * Exported on its own because full-bleed chrome — Today's sticky header — has
 * to line its content up with the column below it without inheriting the
 * column's vertical rhythm.
 */
export const pageWidthVariants = cva("mx-auto w-full px-4 sm:px-6", {
  variants: {
    width: {
      /** 768px — forms, settings, single-column reading. */
      narrow: "max-w-3xl",
      /** 1280px — data tables, dashboards, anything multi-column. */
      content: "max-w-7xl",
      full: "max-w-none",
    },
  },
  defaultVariants: { width: "content" },
});

type PageContainerProps = VariantProps<typeof pageWidthVariants> & {
  children: ReactNode;
  className?: string;
};

/**
 * The standard body of a dashboard page: one centred column with a consistent
 * gutter and a 24px rhythm between sections.
 *
 * The page owns its own top gap on both platforms now. It used to be mobile-only
 * because a breadcrumb bar sat above on desktop and supplied one; with that gone
 * the desktop pages started flush against the top of the inset.
 */
export function PageContainer({
  width,
  className,
  children,
}: PageContainerProps) {
  return (
    <div
      className={cn(
        pageWidthVariants({ width }),
        "flex min-w-0 flex-1 flex-col gap-6 pt-4 pb-16 md:pt-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
