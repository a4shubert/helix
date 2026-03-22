"use client";

import type {
  CellDoubleClickedEvent,
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridReadyEvent,
  PaginationChangedEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardCardShell } from "@/components/dashboard/DashboardCardShell";
import { HelixAgTable } from "@/components/grid/HelixAgTable";
import { HelixHelpTooltip } from "@/components/grid/HelixHelpTooltip";
import type { PortfolioPosition, PortfolioResponse } from "@/lib/api/types";
import { formatUkDateTime } from "@/lib/format/date";
import { formatDecimal, formatInteger } from "@/lib/format/number";

function normalizePosition(
  portfolioId: string,
  position: PortfolioPosition | Record<string, unknown>,
): PortfolioPosition {
  const raw = position as Record<string, unknown>;
  return {
    portfolioId: String(raw.portfolioId ?? portfolioId),
    positionId: String(raw.positionId ?? raw.position_id ?? ""),
    instrumentId: String(raw.instrumentId ?? raw.instrument_id ?? ""),
    instrumentName: String(raw.instrumentName ?? raw.instrument_name ?? ""),
    assetClass: String(raw.assetClass ?? raw.asset_class ?? ""),
    currency: String(raw.currency ?? ""),
    quantity: Number(raw.quantity ?? 0),
    direction: String(raw.direction ?? "LONG") as "LONG" | "SHORT",
    averageCost: Number(raw.averageCost ?? raw.average_cost ?? 0),
    lastUpdateTs: String(raw.lastUpdateTs ?? raw.last_update_ts ?? ""),
    marketPrice: Number(raw.marketPrice ?? raw.market_price ?? 0),
    marketDataTs: String(raw.marketDataTs ?? raw.market_data_ts ?? ""),
    notional: Number(raw.notional ?? 0),
    marketValue: Number(raw.marketValue ?? raw.market_value ?? 0),
    book: String(raw.book ?? ""),
  };
}

const formatIntegerCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatInteger(params.value) : (params.value ?? "");

const formatDecimalCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatDecimal(params.value) : (params.value ?? "");

const columnDefs: ColDef[] = [
  { field: "positionId", headerName: "Position ID", minWidth: 130 },
  { field: "instrumentId", headerName: "Instrument ID", minWidth: 130 },
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
  {
    field: "lastUpdateTs",
    headerName: "Last Update Timestamp",
    minWidth: 210,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as PortfolioPosition | undefined)?.lastUpdateTs),
  },
  {
    field: "marketPrice",
    headerName: "Market Price",
    minWidth: 140,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "marketDataTs",
    headerName: "Market Data Timestamp",
    minWidth: 210,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as PortfolioPosition | undefined)?.marketDataTs),
  },
  { field: "book", headerName: "Book", minWidth: 170 },
];

const defaultColDef: ColDef = {
  sortable: true,
  filter: true,
  resizable: true,
  valueFormatter: (params) => {
    if (typeof params.value !== "number") {
      if (typeof params.value === "string") {
        if (
          params.column.getColId() === "lastUpdateTs" ||
          params.column.getColId() === "marketDataTs"
        ) {
          return formatUkDateTime(params.value);
        }
      }

      return params.value ?? "";
    }

    const isPriceColumn =
      params.column.getColId() === "averageCost" ||
      params.column.getColId() === "marketPrice";

    return isPriceColumn ? formatDecimal(params.value) : formatInteger(params.value);
  },
};

const PAGE_SIZE = 5;

const helpItems = [
  "Single click focuses a cell; copy with Cmd+C (macOS) or Ctrl+C (Windows/Linux).",
  "Double click a cell to toggle selecting its entire row.",
  "Press Esc to clear all column filters.",
  "Use the X button to clear any selected rows (de-select all).",
  "Use the filter-reset button to clear all column filters.",
  "Use Fit Columns to size by header and Fit Data to auto-size to visible content.",
  "Pagination buttons move through the filtered positions dataset page by page.",
];

export function PortfolioPositionsTable({
  portfolio,
  collapsed,
  onToggle,
}: {
  portfolio: PortfolioResponse;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const gridApiRef = useRef<GridApi<PortfolioPosition> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleEnd, setVisibleEnd] = useState(0);
  const [visibleTotalRows, setVisibleTotalRows] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const normalizedPositions = useMemo(
    () =>
      portfolio.positions.map((position) =>
        normalizePosition(portfolio.portfolioId, position as PortfolioPosition | Record<string, unknown>),
      ),
    [portfolio.portfolioId, portfolio.positions],
  );
  const totalRows = normalizedPositions.length;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  function refreshPaginationState(api: GridApi<PortfolioPosition>) {
    const nextCurrent = (api.paginationGetCurrentPage?.() ?? 0) + 1;
    const nextLast = Math.max(1, api.paginationGetTotalPages?.() ?? 1);
    const displayed = api.getDisplayedRowCount?.() ?? 0;
    const firstDisplayed = api.getFirstDisplayedRowIndex?.() ?? -1;
    const lastDisplayed = api.getLastDisplayedRowIndex?.() ?? -1;

    setCurrentPage(nextCurrent);
    setLastPage(nextLast);
    setVisibleTotalRows(displayed);
    setVisibleStart(firstDisplayed >= 0 ? firstDisplayed + 1 : 0);
    setVisibleEnd(lastDisplayed >= 0 ? lastDisplayed + 1 : 0);
  }

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

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      handleFitColumnsToData();
      if (gridApiRef.current) {
        refreshPaginationState(gridApiRef.current);
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [normalizedPositions]);

  function handleDownloadCsv() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    api.exportDataAsCsv({
      fileName: `${portfolio.portfolioId.toLowerCase()}-positions.csv`,
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
    api.paginationGoToFirstPage?.();
    refreshPaginationState(api);
  }

  function handleGoToFirstPage() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    api.paginationGoToFirstPage?.();
    refreshPaginationState(api);
  }

  function handleGoToPreviousPage() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    api.paginationGoToPreviousPage?.();
    refreshPaginationState(api);
  }

  function handleGoToNextPage() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    api.paginationGoToNextPage?.();
    refreshPaginationState(api);
  }

  function handleGoToLastPage() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    api.paginationGoToLastPage?.();
    refreshPaginationState(api);
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
      const api = gridApiRef.current;
      if (!api) {
        return;
      }
      api.setFilterModel(null);
      api.onFilterChanged?.();
      setHasFilters(false);
      api.paginationGoToFirstPage?.();
      refreshPaginationState(api);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasFilters]);

  return (
    <DashboardCardShell
      title="Position"
      collapsed={collapsed}
      onToggle={onToggle}
      expandedClassName="h-[390px] shrink-0"
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
              Page {currentPage} of {lastPage}; Rows: {visibleStart && visibleEnd ? `${visibleStart}-${visibleEnd}` : "0"};
              ; Total Rows {visibleTotalRows} (All {totalRows})
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
            onClick={handleGoToPreviousPage}
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
            onClick={handleGoToNextPage}
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
            onClick={handleGoToLastPage}
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
          rowData={normalizedPositions}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="positionId"
          onGridReady={(event: GridReadyEvent<PortfolioPosition>) => {
            gridApiRef.current = event.api;
            requestAnimationFrame(() => {
              handleFitColumnsToData();
              refreshPaginationState(event.api);
            });
          }}
          onPaginationChanged={(event: PaginationChangedEvent<PortfolioPosition>) => {
            refreshPaginationState(event.api);
          }}
          onSelectionChanged={(event: SelectionChangedEvent<PortfolioPosition>) => {
            setSelectedCount(event.api.getSelectedNodes().length);
          }}
          onCellDoubleClicked={(event: CellDoubleClickedEvent<PortfolioPosition>) => {
            if (!event.node) {
              return;
            }
            event.node.setSelected(!event.node.isSelected());
            setSelectedCount(event.api.getSelectedNodes().length);
          }}
          onFilterChanged={(event: FilterChangedEvent<PortfolioPosition>) => {
            const filterModel = event.api.getFilterModel();
            setHasFilters(Object.keys(filterModel ?? {}).length > 0);
            event.api.paginationGoToFirstPage?.();
            refreshPaginationState(event.api);
          }}
          gridOptions={{
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
