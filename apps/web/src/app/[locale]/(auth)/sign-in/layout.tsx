import type { ReactNode } from "react";

export default function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center px-6 py-16">
      {children}
    </main>
  );
}
