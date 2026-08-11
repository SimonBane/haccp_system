import type { ReactNode } from "react";
import { CenteredShell } from "@/components/layout/centered-shell";

export default function SignUpLayout({ children }: { children: ReactNode }) {
  return <CenteredShell>{children}</CenteredShell>;
}
