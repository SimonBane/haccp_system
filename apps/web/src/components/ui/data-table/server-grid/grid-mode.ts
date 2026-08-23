import type { DataTableServerConfig } from "./types";

/**
 * The TanStack options each execution mode implies. Server mode must switch all
 * three manual flags together — leaving one off would re-process the page that the
 * API already filtered, sorted and paginated.
 */
export type GridTableMode = {
  mode: "client" | "server";
  manualPagination: boolean;
  manualSorting: boolean;
  manualFiltering: boolean;
  rowCount: number | undefined;
};

export function resolveGridTableMode(
  server: Pick<DataTableServerConfig, "rowCount"> | undefined,
): GridTableMode {
  if (!server) {
    return {
      mode: "client",
      manualPagination: false,
      manualSorting: false,
      manualFiltering: false,
      rowCount: undefined,
    };
  }

  return {
    mode: "server",
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    rowCount: server.rowCount,
  };
}
