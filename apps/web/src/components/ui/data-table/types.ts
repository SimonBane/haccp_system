import type { ReactNode } from "react";
import "@tanstack/react-table";

export type DataTableSectionHeader = {
  id: string;
  label: ReactNode;
  className?: string;
};

export type DataTableSection<TData> = DataTableSectionHeader & {
  data: TData[];
};

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    view_label?: string;
    description?: string;
    className?: string;
    sticky?: boolean;
    hidden?: boolean;
  }
}
