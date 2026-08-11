import { CenteredShell } from "@/components/layout/centered-shell";
import { Separator } from "@/components/ui/separator";

type StatusPageProps = {
  code: string;
  message: string;
};

export function StatusPage({ code, message }: StatusPageProps) {
  return (
    <CenteredShell>
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-semibold leading-none">{code}</h1>
        <Separator orientation="vertical" className="h-12" />
        <p className="text-sm leading-normal">{message}</p>
      </div>
    </CenteredShell>
  );
}
