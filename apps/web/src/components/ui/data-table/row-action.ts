import type { ReactNode } from "react";

export type RowAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /**
   * "primary" — listed first, never in the swipe tray.
   * "destructive" — at most one; swipe-left reveals it.
   */
  role?: "default" | "primary" | "destructive";
  /** Omitted from every surface (status gates). */
  hidden?: boolean;
  /** Shown but not activatable; `disabledReason` is the tooltip / sheet hint. */
  disabled?: boolean;
  disabledReason?: string;
};

export type GetRowActions<TData> = (row: TData) => RowAction[];

export function visibleRowActions(actions: RowAction[]): RowAction[] {
  return actions.filter((action) => !action.hidden);
}

export function destructiveRowAction(
  actions: RowAction[],
): RowAction | undefined {
  return visibleRowActions(actions).find(
    (action) => action.role === "destructive" && !action.disabled,
  );
}
