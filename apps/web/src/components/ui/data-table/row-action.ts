import type { ReactNode } from "react";

/**
 * One thing you can do to a row, declared once and rendered three ways: the
 * desktop overflow menu, the mobile long-press sheet, and the mobile swipe-left
 * tray.
 *
 * Data rather than JSX, because the three surfaces disagree about markup — a
 * menu item, a full-width sheet button, a coloured tray tile — but never about
 * what the actions *are*. Each feature used to hand-write all three.
 */
export type RowAction = {
  /** Stable across renders; used as the React key. */
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  /**
   * "primary"     — what a tap on the row already does. Listed first so the
   *                 sheet reads as complete, never in the swipe tray.
   * "destructive" — rendered apart, and the single action swipe-left reveals.
   *                 At most one per row.
   */
  role?: "default" | "primary" | "destructive";
  /**
   * Omitted from every surface. For status gates — "send invitation" exists
   * only on an employee who has not been invited yet.
   */
  hidden?: boolean;
  /**
   * Rendered but not activatable. `disabledReason` becomes the desktop menu
   * item's tooltip and the sheet's inline hint, so "why can't I delete this"
   * is answered in place rather than by a disabled control with no explanation.
   */
  disabled?: boolean;
  disabledReason?: string;
};

/** Actions for one row. Called per render, so keep it cheap. */
export type GetRowActions<TData> = (row: TData) => RowAction[];

export function visibleRowActions(actions: RowAction[]): RowAction[] {
  return actions.filter((action) => !action.hidden);
}

/** The one action swipe-left reveals, if the row has one it can run. */
export function destructiveRowAction(
  actions: RowAction[],
): RowAction | undefined {
  return visibleRowActions(actions).find(
    (action) => action.role === "destructive" && !action.disabled,
  );
}
