import type {
  OnChangeFn,
  PaginationState,
  RowSelectionState,
  SortingState,
} from "@tanstack/react-table";
import type { SortOrder } from "@haccp/shared";

export type GridSortState = { id: string; desc: boolean } | null;

export type GridFilterState = Record<string, string[]>;

export type GridDefaultSort = { sortBy: string; sortOrder: SortOrder };

export type GridCapabilities = {
  search: boolean;
  sorting: boolean;
  pagination: boolean;
  filtering: boolean;
  selection: boolean;
  columnVisibility: boolean;
};

export const DEFAULT_GRID_CAPABILITIES: GridCapabilities = {
  search: true,
  sorting: true,
  pagination: true,
  filtering: false,
  selection: false,
  columnVisibility: false,
};

export type GridRequest = {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: SortOrder;
  filters?: Record<string, string[]>;
};

export type DataTableServerConfig = {
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  sorting: SortingState;
  onSortingChange: OnChangeFn<SortingState>;
  rowCount: number;
  search: string;
  onSearchChange: (value: string) => void;
  filters: GridFilterState;
  onFilterChange: (key: string, values: string[]) => void;
  onClearFilters: () => void;
  rowSelection: RowSelectionState;
  onRowSelectionChange: OnChangeFn<RowSelectionState>;
  isFetching: boolean;
  isPlaceholderData: boolean;
  hasActiveQuery: boolean;
};
