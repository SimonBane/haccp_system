import { Spinner } from "@/components/ui/spinner";

export function FullPageLoader() {
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background">
      <Spinner className="size-6 text-muted-foreground" />
    </div>
  );
}
