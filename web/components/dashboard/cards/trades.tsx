"use client";

import type {
  CellDoubleClickedEvent,
  ColDef,
  FilterChangedEvent,
  GridReadyEvent,
  PaginationChangedEvent,
  SelectionChangedEvent,
} from "ag-grid-community";
import { useMemo, useState } from "react";
import { DashboardCardShell } from "@/components/dashboard/base/dashboard-card-shell";
import { HelixHelpTooltip } from "@/components/grid/helix-help-tooltip";
import { HelixAgTable } from "@/components/grid/helix-ag-table";
import { useHelixTableControls } from "@/components/grid/use-helix-table-controls";
import { formatUkDate, formatUkDateTime } from "@/lib/format/date";
import { formatDecimal, formatInteger } from "@/lib/format/number";
import type { StrategyTrade } from "@/lib/types/dashboard";

function normalizeTrade(trade: StrategyTrade | Record<string, unknown>): StrategyTrade {
  const raw = trade as Record<string, unknown>;
  return {
    trade_id: String(raw.trade_id ?? raw.tradeId ?? ""),
    strategy_id: String(raw.strategy_id ?? raw.strategyId ?? raw.portfolio_id ?? raw.portfolioId ?? ""),
    position_id: String(raw.position_id ?? raw.positionId ?? ""),
    instrument_id: String(raw.instrument_id ?? raw.instrumentId ?? ""),
    instrument_name: String(raw.instrument_name ?? raw.instrumentName ?? ""),
    asset_class: String(raw.asset_class ?? raw.assetClass ?? ""),
    currency: String(raw.currency ?? ""),
    side: String(raw.side ?? ""),
    quantity: Number(raw.quantity ?? 0),
    price: Number(raw.price ?? 0),
    notional:
      raw.notional === null || raw.notional === undefined ? null : Number(raw.notional),
    trade_timestamp: String(raw.trade_timestamp ?? raw.tradeTimestamp ?? ""),
    settlement_date: String(raw.settlement_date ?? raw.settlementDate ?? ""),
    book: String(raw.book ?? ""),
    status: String(raw.status ?? ""),
    version: Number(raw.version ?? 1),
    created_at: String(raw.created_at ?? raw.createdAt ?? ""),
    updated_at: String(raw.updated_at ?? raw.updatedAt ?? ""),
  };
}

const formatIntegerCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatInteger(params.value) : (params.value ?? "");

const formatDecimalCell: NonNullable<ColDef["valueFormatter"]> = (params) =>
  typeof params.value === "number" ? formatDecimal(params.value) : (params.value ?? "");

const columnDefs: ColDef<StrategyTrade>[] = [
  { field: "trade_id", headerName: "Trade ID", minWidth: 150 },
  { field: "instrument_id", headerName: "Instrument ID", minWidth: 130 },
  { field: "instrument_name", headerName: "Instrument Name", minWidth: 220 },
  { field: "asset_class", headerName: "Asset Class", minWidth: 130 },
  { field: "currency", headerName: "Currency", minWidth: 110 },
  { field: "side", headerName: "Side", minWidth: 100 },
  {
    field: "quantity",
    headerName: "Quantity",
    minWidth: 140,
    type: "numericColumn",
    valueFormatter: formatIntegerCell,
  },
  {
    field: "price",
    headerName: "Price",
    minWidth: 140,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "notional",
    headerName: "Notional",
    minWidth: 160,
    type: "numericColumn",
    valueFormatter: formatDecimalCell,
  },
  {
    field: "trade_timestamp",
    headerName: "Trade Timestamp",
    minWidth: 220,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as StrategyTrade | undefined)?.trade_timestamp),
  },
  {
    field: "settlement_date",
    headerName: "Settlement Date",
    minWidth: 155,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDate((params.data as StrategyTrade | undefined)?.settlement_date),
  },
  { field: "book", headerName: "Book", minWidth: 160 },
  { field: "status", headerName: "Status", minWidth: 120 },
  {
    field: "version",
    headerName: "Version",
    minWidth: 110,
    type: "numericColumn",
    valueFormatter: formatIntegerCell,
  },
  {
    field: "created_at",
    headerName: "Created At",
    minWidth: 210,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as StrategyTrade | undefined)?.created_at),
  },
  {
    field: "updated_at",
    headerName: "Updated At",
    minWidth: 210,
    filter: "agTextColumnFilter",
    cellDataType: "text",
    filterValueGetter: (params) =>
      formatUkDateTime((params.data as StrategyTrade | undefined)?.updated_at),
  },
];

const defaultColDef: ColDef<StrategyTrade> = {
  sortable: true,
  filter: true,
  resizable: true,
  valueFormatter: (params) => {
    if (typeof params.value !== "number") {
      if (typeof params.value === "string") {
        if (params.column.getColId() === "settlement_date") {
          return formatUkDate(params.value);
        }

        if (
          params.column.getColId() === "trade_timestamp" ||
          params.column.getColId() === "created_at" ||
          params.column.getColId() === "updated_at"
        ) {
          return formatUkDateTime(params.value);
        }
      }

      return params.value ?? "";
    }

    const isDecimalColumn =
      params.column.getColId() === "price" || params.column.getColId() === "notional";

    return isDecimalColumn ? formatDecimal(params.value) : formatInteger(params.value);
  },
};

const PAGE_SIZE = 15;

const helpItems = [
  "Single click focuses a cell; copy with Cmd+C (macOS) or Ctrl+C (Windows/Linux).",
  "Double click a cell to toggle selecting its entire row.",
  "Press Esc to clear all column filters.",
  "Use the X button to clear any selected rows (de-select all).",
  "Use the filter-reset button to clear all column filters.",
  "Use Fit Columns to size by header and Fit Data to auto-size to visible content.",
  "Pagination buttons move through the filtered trades dataset page by page.",
];

function buildMockTrade(seed: number): StrategyTrade {
  const padded = String(seed).padStart(2, "0");
  return {
    trade_id: `TRD-PF-MOCK-2026040416263${padded}`,
    strategy_id: "STRAT-MK",
    position_id: `POS-MOCK-${padded}`,
    instrument_id: "NG1",
    instrument_name: "Natural Gas",
    asset_class: "Commodity",
    currency: "USD",
    side: seed % 2 === 0 ? "BUY" : "SELL",
    quantity: 5 + seed,
    price: 2.15 + seed / 100,
    notional: (5 + seed) * (2.15 + seed / 100),
    trade_timestamp: "2026-04-04T17:26:35Z",
    settlement_date: "2026-04-06",
    book: "CM-MOCK",
    status: "accepted",
    version: 1,
    created_at: "2026-04-04T17:26:35Z",
    updated_at: "2026-04-04T17:26:35Z",
  };
}

export function Trades({
  strategyId,
  initialTrades,
  isExpanded = false,
}: Readonly<{
  strategyId: string;
  initialTrades: StrategyTrade[];
  isExpanded?: boolean;
}>) {
  const [collapsed, setCollapsed] = useState(!isExpanded);
  const [selectedTrade, setSelectedTrade] = useState<StrategyTrade | null>(null);
  const [tradeSeed, setTradeSeed] = useState(0);
  const [trades, setTrades] = useState(initialTrades);

  const normalizedTrades = useMemo(
    () =>
      trades.map((trade) =>
        normalizeTrade(trade as StrategyTrade | Record<string, unknown>),
      ),
    [trades],
  );

  const {
    gridApiRef,
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
  } = useHelixTableControls<StrategyTrade>({
    csvFileName: `${strategyId.toLowerCase()}-trades.csv`,
    autoFitToken: normalizedTrades,
    onClearSelection: () => {
      setSelectedTrade(null);
    },
  });

  const totalRows = normalizedTrades.length;
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  function handleAddMockTrade() {
    const nextSeed = tradeSeed + 1;
    setTradeSeed(nextSeed);
    setTrades((current) => [buildMockTrade(nextSeed), ...current]);
  }

  function handleDeleteSelectedTrade() {
    if (!selectedTrade) {
      return;
    }

    setTrades((current) =>
      current.filter((trade) => trade.trade_id !== selectedTrade.trade_id),
    );
    gridApiRef.current?.deselectAll();
    setSelectedTrade(null);
  }

  return (
    <DashboardCardShell
      title="Trades"
      collapsed={collapsed}
      onToggle={() => setCollapsed((value) => !value)}
      expandedClassName="shrink-0"
    >
      <div className="mb-4 mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--color-muted)]">
          <button
            type="button"
            onClick={handleAddMockTrade}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-[color:var(--color-accent)] px-3 py-1 text-sm font-medium text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
            title="Add a mock trade"
          >
            Add
          </button>
          <button
            type="button"
            onClick={handleDeleteSelectedTrade}
            disabled={!selectedTrade}
            className={[
              "inline-flex shrink-0 items-center justify-center rounded-md border px-3 py-1 text-sm font-medium",
              "border-rose-500/50 text-rose-300",
              selectedTrade ? "hover:bg-rose-500/10" : "cursor-not-allowed opacity-50",
            ].join(" ")}
            title={selectedTrade ? "Delete selected trade" : "Select one trade to delete"}
          >
            Delete
          </button>
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
          rowData={normalizedTrades}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="trade_id"
          onGridReady={(event: GridReadyEvent<StrategyTrade>) => {
            attachApi(event.api);
            requestAnimationFrame(() => {
              handleFitColumnsToData();
              refreshPaginationState(event.api);
            });
          }}
          onPaginationChanged={(event: PaginationChangedEvent<StrategyTrade>) => {
            refreshPaginationState(event.api);
          }}
          onSelectionChanged={(event: SelectionChangedEvent<StrategyTrade>) => {
            const selectedRows = event.api.getSelectedRows();
            setSelectedTrade(selectedRows[0] ?? null);
            handleSelectionCountChanged(event.api);
          }}
          onCellDoubleClicked={(event: CellDoubleClickedEvent<StrategyTrade>) => {
            if (!event.node) {
              return;
            }
            event.node.setSelected(!event.node.isSelected());
            const selectedRows = event.api.getSelectedRows();
            setSelectedTrade(selectedRows[0] ?? null);
            handleSelectionCountChanged(event.api);
          }}
          onFilterChanged={(event: FilterChangedEvent<StrategyTrade>) => {
            handleFilterChanged(event.api);
          }}
          gridOptions={{
            domLayout: "autoHeight",
            pagination: true,
            paginationPageSize: PAGE_SIZE,
            paginationPageSizeSelector: false,
            suppressPaginationPanel: true,
            rowSelection: {
              mode: "singleRow",
              enableClickSelection: false,
              checkboxes: false,
            },
            suppressColumnVirtualisation: true,
          }}
        />
      </div>
    </DashboardCardShell>
  );
}
