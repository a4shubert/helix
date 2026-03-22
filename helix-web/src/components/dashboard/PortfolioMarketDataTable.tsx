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
import { DashboardCardShell } from "@/components/dashboard/DashboardCardShell";
import { HelixHelpTooltip } from "@/components/grid/HelixHelpTooltip";
import { HelixAgTable } from "@/components/grid/HelixAgTable";
import type { MarketDataRow } from "@/lib/api/types";
import { formatDecimal } from "@/lib/format/number";

const columnDefs: ColDef<MarketDataRow>[] = [
  { field: "instrumentId", headerName: "Instrument ID", minWidth: 140 },
  { field: "instrumentName", headerName: "Instrument Name", minWidth: 220 },
  { field: "assetClass", headerName: "Asset Class", minWidth: 140 },
  { field: "currency", headerName: "Currency", minWidth: 110 },
  {
    field: "price",
    headerName: "Price",
    minWidth: 140,
    type: "numericColumn",
    valueFormatter: (params) =>
      typeof params.value === "number" ? formatDecimal(params.value) : "",
  },
  { field: "updatedAt", headerName: "Updated At", minWidth: 220 },
];

const defaultColDef: ColDef<MarketDataRow> = {
  sortable: true,
  filter: true,
  resizable: true,
  valueFormatter: (params) => {
    if (params.column.getColId() === "updatedAt" && typeof params.value === "string" && params.value) {
      return new Date(params.value).toLocaleString("en-GB", { hour12: false });
    }
    return params.value ?? "";
  },
};

const PAGE_SIZE = 20;

const helpItems = [
  "Single click focuses a cell; copy with Cmd+C (macOS) or Ctrl+C (Windows/Linux).",
  "Double click a cell to toggle selecting its entire row.",
  "Press Esc to clear all column filters.",
  "Use the X button to clear any selected rows (de-select all).",
  "Use the filter-reset button to clear all column filters.",
  "Use Fit Columns to size by header and Fit Data to auto-size to visible content.",
  "Pagination buttons move through the market data dataset page by page.",
];

export function PortfolioMarketDataTable({
  rows,
  asOf,
  collapsed,
  onToggle,
}: {
  rows: MarketDataRow[];
  asOf?: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const gridApiRef = useRef<GridApi<MarketDataRow> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const totalRows = rows.length;
  const lastPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const page = Math.min(currentPage, lastPage);
  const currentRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [page, rows]);
  const hasPrev = page > 1;
  const hasNext = page < lastPage;

  function handleFitColumnsToHeader() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const cols = api.getAllDisplayedColumns?.() ?? [];
    const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
    if (colIds.length === 0) {
      return;
    }
    api.autoSizeColumns?.(colIds, false);
  }

  function handleFitColumnsToData() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const cols = api.getAllDisplayedColumns?.() ?? [];
    const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
    if (colIds.length === 0) {
      return;
    }
    api.autoSizeColumns?.(colIds, true);
  }

  function handleDownloadCsv() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    api.exportDataAsCsv({
      fileName: "market-data.csv",
    });
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
    const frame = requestAnimationFrame(() => {
      handleFitColumnsToData();
    });
    return () => cancelAnimationFrame(frame);
  }, [currentRows]);

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
    <DashboardCardShell
      title="Market Data"
      subtitle={asOf ? `(${new Date(asOf).toLocaleString("en-GB", { hour12: false }).replaceAll(",", "")})` : undefined}
      collapsed={collapsed}
      onToggle={onToggle}
      expandedClassName="h-[780px] shrink-0"
    >
      <div className="mb-4 mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-4 text-sm text-[color:var(--color-muted)]">
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
            {(() => {
              const start = (page - 1) * PAGE_SIZE + 1;
              const end = (page - 1) * PAGE_SIZE + currentRows.length;
              return (
                <>
                  Page {page} of {lastPage}; Rows: {currentRows.length ? `${start}-${end}` : "0"};
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
      <div className="min-h-0 flex-1 w-full">
        <HelixAgTable
          rowData={currentRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="instrumentId"
          onGridReady={(event: GridReadyEvent<MarketDataRow>) => {
            gridApiRef.current = event.api;
            requestAnimationFrame(() => {
              handleFitColumnsToData();
            });
          }}
          onSelectionChanged={(event: SelectionChangedEvent<MarketDataRow>) => {
            setSelectedCount(event.api.getSelectedNodes().length);
          }}
          onCellDoubleClicked={(event: CellDoubleClickedEvent<MarketDataRow>) => {
            if (!event.node) {
              return;
            }
            event.node.setSelected(!event.node.isSelected());
            setSelectedCount(event.api.getSelectedNodes().length);
          }}
          onFilterChanged={(event: FilterChangedEvent<MarketDataRow>) => {
            const filterModel = event.api.getFilterModel();
            setHasFilters(Object.keys(filterModel ?? {}).length > 0);
            setCurrentPage(1);
          }}
          gridOptions={{
            rowSelection: {
              mode: "singleRow",
              enableClickSelection: false,
              checkboxes: false,
            },
          }}
        />
      </div>
    </DashboardCardShell>
  );
}
