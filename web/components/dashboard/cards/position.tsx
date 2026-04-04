"use client";

import type {
  CellDoubleClickedEvent,
  ColDef,
  FilterChangedEvent,
  GridReadyEvent,
  PaginationChangedEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { useState } from "react";
import { DashboardCardShell } from "@/components/dashboard/base/dashboard-card-shell";
import { HelixAgTable } from "@/components/grid/helix-ag-table";
import { HelixHelpTooltip } from "@/components/grid/helix-help-tooltip";
import { useHelixTableControls } from "@/components/grid/use-helix-table-controls";
import { formatUkDateTime } from "@/lib/format/date";
import { formatDecimal, formatInteger } from "@/lib/format/number";
import type { PositionRow } from "@/lib/types/dashboard";

const PAGE_SIZE = 10;

const formatIntegerCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatInteger(params.value) : (params.value ?? "");

const formatDecimalCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatDecimal(params.value) : (params.value ?? "");

const columnDefs: ColDef<PositionRow>[] = [
  { field: "position_id", headerName: "Position ID", minWidth: 150 },
  { field: "instrument_id", headerName: "Instrument ID", minWidth: 130 },
  { field: "instrument_name", headerName: "Instrument Name", minWidth: 220 },
  { field: "asset_class", headerName: "Asset Class", minWidth: 140 },
  { field: "currency", headerName: "Currency", minWidth: 110 },
  { field: "direction", headerName: "Direction", minWidth: 120 },
  {
    field: "quantity",
    headerName: "Quantity",
    minWidth: 130,
    type: "numericColumn",
    valueFormatter: formatIntegerCell,
  },
  {
    field: "notional",
    headerName: "Notional",
    minWidth: 150,
    type: "numericColumn",
    valueFormatter: formatIntegerCell,
  },
  {
    field: "market_price",
    headerName: "Market Price",
    minWidth: 150,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "realized_pnl",
    headerName: "Realized P&L",
    minWidth: 160,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "unrealized_pnl",
    headerName: "Unrealized P&L",
    minWidth: 170,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "total_pnl",
    headerName: "Total P&L",
    minWidth: 150,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "average_cost",
    headerName: "Average Cost",
    minWidth: 150,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "last_update_ts",
    headerName: "Last Update Timestamp",
    minWidth: 220,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as PositionRow | undefined)?.last_update_ts),
  },
  {
    field: "market_data_ts",
    headerName: "Market Data Timestamp",
    minWidth: 220,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as PositionRow | undefined)?.market_data_ts),
  },
  { field: "book", headerName: "Book", minWidth: 160 },
];

const defaultColDef: ColDef<PositionRow> = {
  sortable: true,
  filter: true,
  resizable: true,
  valueFormatter: (params) => {
    if (typeof params.value !== "number") {
      if (typeof params.value === "string") {
        if (
          params.column.getColId() === "last_update_ts" ||
          params.column.getColId() === "market_data_ts"
        ) {
          return formatUkDateTime(params.value);
        }
      }
      return params.value ?? "";
    }

    const isPriceColumn =
      params.column.getColId() === "average_cost" ||
      params.column.getColId() === "market_price";

    return isPriceColumn ? formatDecimal(params.value) : formatInteger(params.value);
  },
};

const helpItems = [
  "Single click focuses a cell; copy with Cmd+C (macOS) or Ctrl+C (Windows/Linux).",
  "Double click a cell to toggle selecting its entire row.",
  "Press Esc to clear all column filters.",
  "Use the X button to clear any selected rows.",
  "Use the filter-reset button to clear all column filters.",
  "Use Fit Columns to size by header and Fit Data to auto-size to visible content.",
  "Pagination buttons move through the filtered positions dataset page by page.",
];

export function Position({
  rows,
  isExpanded = false,
}: Readonly<{
  rows: PositionRow[];
  isExpanded?: boolean;
}>) {
  const [collapsed, setCollapsed] = useState(!isExpanded);
  const {
    currentPage,
    lastPage,
    visibleStart,
    visibleEnd,
    visibleTotalRows,
    selectedCount,
    hasFilters,
    attachApi,
    refreshPaginationState,
    handleFitColumnsToHeader,
    handleFitColumnsToData,
    handleDownloadCsv,
    handleResetFilters,
    handleGoToFirstPage,
    handleGoToPreviousPage,
    handleGoToNextPage,
    handleGoToLastPage,
    handleClearSelection,
    handleFilterChanged,
    handleSelectionCountChanged,
  } = useHelixTableControls<PositionRow>({
    csvFileName: "positions.csv",
    autoFitToken: rows,
  });

  const totalRows = rows.length;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  return (
    <DashboardCardShell
      title="Position"
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
      expandedClassName="shrink-0"
    >
      <div className="mb-4 mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--color-muted)]">
          <button
            type="button"
            onClick={handleFitColumnsToHeader}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-accent)]"
            title="Fit columns to header"
          >
            Fit Columns
          </button>
          <button
            type="button"
            onClick={handleFitColumnsToData}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-accent)]"
            title="Auto-size columns to content"
          >
            Fit Data
          </button>
          <button
            type="button"
            onClick={handleDownloadCsv}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-transparent px-2 py-1 text-sm text-[color:var(--color-muted)] hover:border-[color:var(--color-border)] hover:text-[color:var(--color-accent)]"
            title="Download table as CSV"
          >
            Download CSV
          </button>
          <HelixHelpTooltip items={helpItems} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 text-sm text-[color:var(--color-muted)]">
            <>
              Page {currentPage} of {lastPage}; Rows:{" "}
              {visibleStart && visibleEnd ? `${visibleStart}-${visibleEnd}` : "0"};
              {" "}Total Rows {visibleTotalRows} (All {totalRows})
            </>
          </div>
          <button
            type="button"
            aria-disabled={!hasPrev}
            disabled={!hasPrev}
            onClick={handleGoToFirstPage}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasPrev ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="First page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-disabled={!hasPrev}
            disabled={!hasPrev}
            onClick={handleGoToPreviousPage}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasPrev ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Previous page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-disabled={!hasNext}
            disabled={!hasNext}
            onClick={handleGoToNextPage}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasNext ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Next page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-disabled={!hasNext}
            disabled={!hasNext}
            onClick={handleGoToLastPage}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasNext ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Last page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M6 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-disabled={!hasFilters}
            disabled={!hasFilters}
            onClick={handleResetFilters}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasFilters ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Reset filters"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 6h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M10 18h4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-disabled={selectedCount === 0}
            disabled={selectedCount === 0}
            onClick={handleClearSelection}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              selectedCount ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title={selectedCount ? `Clear selection (${selectedCount})` : "Clear selection"}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <path d="M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      <div className="w-full">
        <HelixAgTable
          height="auto"
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="position_id"
          onGridReady={(event: GridReadyEvent<PositionRow>) => {
            attachApi(event.api);
            requestAnimationFrame(() => {
              handleFitColumnsToData();
              refreshPaginationState(event.api);
            });
          }}
          onPaginationChanged={(event: PaginationChangedEvent<PositionRow>) => {
            refreshPaginationState(event.api);
          }}
          onSelectionChanged={(event: SelectionChangedEvent<PositionRow>) => {
            handleSelectionCountChanged(event.api);
          }}
          onCellDoubleClicked={(event: CellDoubleClickedEvent<PositionRow>) => {
            if (!event.node) {
              return;
            }
            event.node.setSelected(!event.node.isSelected());
            handleSelectionCountChanged(event.api);
          }}
          onFilterChanged={(event: FilterChangedEvent<PositionRow>) => {
            handleFilterChanged(event.api);
          }}
          gridOptions={{
            domLayout: "autoHeight",
            pagination: true,
            paginationPageSize: PAGE_SIZE,
            paginationPageSizeSelector: false,
            suppressPaginationPanel: true,
            rowSelection: {
              mode: "multiRow",
              enableSelectionWithoutKeys: true,
              enableClickSelection: false,
              checkboxes: false,
              headerCheckbox: false,
            },
          }}
        />
      </div>
    </DashboardCardShell>
  );
}
