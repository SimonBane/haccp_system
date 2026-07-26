import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/** Uses the same full-width page gutters as the settings workspaces. */
export function TodayWorkspace({ children }: Props) {
  return (
    <div className="w-full">
      <div className="w-full space-y-6 px-4 py-5 sm:px-6 sm:py-6 lg:px-4 lg:py-4">
        {children}
      </div>
    </div>
  );
}
