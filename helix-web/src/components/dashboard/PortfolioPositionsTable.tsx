"use client";

import type {
  CellDoubleClickedEvent,
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridReadyEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { useEffect, useMemo, useRef, useState } from "react";
import { HelixAgTable } from "@/components/grid/HelixAgTable";
import { HelixHelpTooltip } from "@/components/grid/HelixHelpTooltip";
import { formatDecimal, formatInteger } from "@/lib/format/number";
import type { PortfolioResponse } from "@/lib/mock/portfolio";

const formatIntegerCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatInteger(params.value) : (params.value ?? "");

const formatDecimalCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatDecimal(params.value) : (params.value ?? "");

const columnDefs: ColDef[] = [
  {
    headerName: "Portfolio ID",
    minWidth: 130,
    pinned: "left",
    valueGetter: (params) => params.context.portfolioId,
  },
  { field: "positionId", headerName: "Position ID", minWidth: 130, pinned: "left" },
  { field: "instrumentId", headerName: "Instrument ID", minWidth: 130, pinned: "left" },
  { field: "instrumentName", headerName: "Instrument Name", minWidth: 200 },
  { field: "assetClass", headerName: "Asset Class", minWidth: 130 },
  { field: "currency", headerName: "Currency", minWidth: 110 },
  { field: "direction", headerName: "Direction", minWidth: 130 },
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
    minWidth: 160,
    type: "numericColumn",
    valueFormatter: formatIntegerCell,
  },
  {
    field: "averageCost",
    headerName: "Average Cost",
    minWidth: 150,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  { field: "tradeDate", headerName: "Trade Date", minWidth: 135 },
  { field: "lastUpdateTs", headerName: "Last Update Timestamp", minWidth: 210 },
  {
    field: "marketPrice",
    headerName: "Market Price",
    minWidth: 140,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  { field: "marketDataTs", headerName: "Market Data Timestamp", minWidth: 210 },
  {
    field: "fxRate",
    headerName: "FX Rate",
    minWidth: 120,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  { field: "sector", headerName: "Sector", minWidth: 140 },
  { field: "region", headerName: "Region", minWidth: 120 },
  { field: "strategy", headerName: "Strategy / Book", minWidth: 170 },
  { field: "desk", headerName: "Desk", minWidth: 130 },
];

const defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  valueFormatter: (params) => {
    if (typeof params.value !== "number") {
      if (typeof params.value === "string") {
        if (params.column.getColId() === "tradeDate") {
          return new Date(`${params.value}T00:00:00Z`).toLocaleDateString("en-GB");
        }

        if (
          params.column.getColId() === "lastUpdateTs" ||
          params.column.getColId() === "marketDataTs"
        ) {
          return new Date(params.value).toLocaleString("en-GB", { hour12: false });
        }
      }

      return params.value ?? "";
    }

    const isPriceColumn =
      params.column.getColId() === "averageCost" ||
      params.column.getColId() === "marketPrice" ||
      params.column.getColId() === "fxRate";

    return isPriceColumn ? formatDecimal(params.value) : formatInteger(params.value);
  },
};

const PAGE_SIZE = 10;

const helpItems = [
  "Single click focuses a cell; copy with Cmd+C (macOS) or Ctrl+C (Windows/Linux).",
  "Double click a cell to toggle selecting its entire row.",
  "Press Esc to clear all column filters.",
  "Use the X button to clear any selected rows (de-select all).",
  "Use the filter-reset button to clear all column filters.",
  "Use Fit Columns to size by header and Fit Data to auto-size to visible content.",
  "Pagination buttons move through the mock positions dataset page by page; filters affect only the current page in this mock setup.",
];

export function PortfolioPositionsTable({
  portfolio,
}: {
  portfolio: PortfolioResponse;
}) {
  const gridApiRef = useRef<GridApi | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const totalRows = portfolio.positions.length;
  const lastPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return portfolio.positions.slice(start, start + PAGE_SIZE);
  }, [currentPage, portfolio.positions]);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  function handleFitColumnsToHeader() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const cols = api.getAllDisplayedColumns();
    const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
    api.autoSizeColumns?.(colIds, false);
  }

  function handleFitColumnsToData() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const cols = api.getAllDisplayedColumns();
    const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
    api.autoSizeColumns?.(colIds, true);
  }

  function handleResetFilters() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    api.setFilterModel(null);
    api.onFilterChanged?.();
    setHasFilters(false);
    setCurrentPage(1);
  }

  function handleClearSelection() {
    gridApiRef.current?.deselectAll();
    setSelectedCount(0);
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (!hasFilters) {
        return;
      }
      handleResetFilters();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasFilters]);

  return (
    <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)]/70 p-5 shadow-[0_20px_60px_rgba(2,6,23,0.35)]">
      <div className="mb-3 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="text-xl font-semibold uppercase tracking-[0.18em] text-white">
            Positions
          </div>
          <div className="text-lg font-medium tracking-[0.08em] text-white/90">
            {new Date(portfolio.asOf).toLocaleString("en-GB", { hour12: false })}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
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
          <HelixHelpTooltip items={helpItems} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <div className="mr-1 text-sm text-[color:var(--color-muted)]">
            {(() => {
              const start = (currentPage - 1) * PAGE_SIZE + 1;
              const end = (currentPage - 1) * PAGE_SIZE + currentRows.length;

              return (
                <>
                  Page {currentPage} of {lastPage}; Rows: {currentRows.length ? `${start}-${end}` : "0"};
                  Total Rows {totalRows}
                </>
              );
            })()}
          </div>

          <button
            type="button"
            aria-disabled={!hasPrev}
            disabled={!hasPrev}
            onClick={() => setCurrentPage(1)}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasPrev ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="First page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M18 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-disabled={!hasPrev}
            disabled={!hasPrev}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasPrev ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Previous page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-disabled={!hasNext}
            disabled={!hasNext}
            onClick={() => setCurrentPage((page) => Math.min(lastPage, page + 1))}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasNext ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Next page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M9 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            aria-disabled={!hasNext}
            disabled={!hasNext}
            onClick={() => setCurrentPage(lastPage)}
            className={[
              "inline-flex items-center justify-center rounded-md border px-2.5 py-2 text-sm",
              "border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-[color:var(--color-text)]",
              hasNext ? "hover:border-[color:var(--color-accent)]" : "opacity-50",
            ].join(" ")}
            title="Last page"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M6 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M12 6l6 6-6 6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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
              <path
                d="M4 6h16"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M7 12h10"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M10 18h4"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
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

      <div className="h-[460px] w-full">
        <HelixAgTable
          rowData={currentRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="positionId"
          onGridReady={(event: GridReadyEvent) => {
            gridApiRef.current = event.api;
          }}
          onSelectionChanged={(event: SelectionChangedEvent) => {
            setSelectedCount(event.api.getSelectedNodes().length);
          }}
          onCellDoubleClicked={(event: CellDoubleClickedEvent) => {
            if (!event.node) {
              return;
            }
            event.node.setSelected(!event.node.isSelected());
            setSelectedCount(event.api.getSelectedNodes().length);
          }}
          onFilterChanged={(event: FilterChangedEvent) => {
            const filterModel = event.api.getFilterModel();
            setHasFilters(Object.keys(filterModel ?? {}).length > 0);
            setCurrentPage(1);
          }}
          gridOptions={{
            context: { portfolioId: portfolio.portfolioId },
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
    </section>
  );
}
