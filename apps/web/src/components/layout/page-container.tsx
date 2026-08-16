import { cva, type VariantProps } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const pageWidthVariants = cva("mx-auto w-full px-4 sm:px-6", {
  variants: {
    width: {
      narrow: "max-w-3xl",
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
