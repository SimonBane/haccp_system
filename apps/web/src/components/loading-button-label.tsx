import { Loader2Icon } from "lucide-react";
import { cn } from "@/lib/utils";

type LoadingButtonLabelProps = {
  loading: boolean;
  children: React.ReactNode;
};

export function LoadingButtonLabel({
  loading,
  children,
}: LoadingButtonLabelProps) {
  return (
    <>
      <span
        className={cn(
          "inline-flex items-center gap-1.5",
          loading && "invisible",
        )}
      >
        {children}
      </span>
      {loading ? (
        <Loader2Icon
          aria-hidden
          className="absolute top-1/2 left-1/2 size-4 -translate-x-1/2 -translate-y-1/2 animate-spin"
        />
      ) : null}
    </>
  );
}
