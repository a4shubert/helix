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
import { TradeFormModal } from "@/components/dashboard/TradeFormModal";
import { HelixAgTable } from "@/components/grid/HelixAgTable";
import { HelixHelpTooltip } from "@/components/grid/HelixHelpTooltip";
import type { CreateTradeRequest } from "@/lib/api/helix";
import type { PortfolioTrade } from "@/lib/api/types";
import { formatDecimal, formatInteger } from "@/lib/format/number";

function normalizeTrade(trade: PortfolioTrade | Record<string, unknown>): PortfolioTrade {
  const raw = trade as Record<string, unknown>;
  return {
    trade_id: String(raw.trade_id ?? raw.tradeId ?? ""),
    portfolio_id: String(raw.portfolio_id ?? raw.portfolioId ?? ""),
    position_id: String(raw.position_id ?? raw.positionId ?? ""),
    instrument_id: String(raw.instrument_id ?? raw.instrumentId ?? ""),
    instrument_name: String(raw.instrument_name ?? raw.instrumentName ?? ""),
    asset_class: String(raw.asset_class ?? raw.assetClass ?? ""),
    currency: String(raw.currency ?? ""),
    side: String(raw.side ?? ""),
    quantity: Number(raw.quantity ?? 0),
    price: Number(raw.price ?? 0),
    notional:
      raw.notional === null || raw.notional === undefined
        ? null
        : Number(raw.notional),
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

const columnDefs: ColDef<PortfolioTrade>[] = [
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
  { field: "trade_timestamp", headerName: "Trade Timestamp", minWidth: 220 },
  { field: "settlement_date", headerName: "Settlement Date", minWidth: 155 },
  { field: "book", headerName: "Book", minWidth: 160 },
  { field: "status", headerName: "Status", minWidth: 120 },
  {
    field: "version",
    headerName: "Version",
    minWidth: 110,
    type: "numericColumn",
    valueFormatter: formatIntegerCell,
  },
  { field: "created_at", headerName: "Created At", minWidth: 210 },
  { field: "updated_at", headerName: "Updated At", minWidth: 210 },
];

const defaultColDef: ColDef<PortfolioTrade> = {
  sortable: true,
  filter: true,
  resizable: true,
  valueFormatter: (params) => {
    if (typeof params.value !== "number") {
      if (typeof params.value === "string") {
        if (
          params.column.getColId() === "settlement_date"
        ) {
          return new Date(`${params.value}T00:00:00Z`).toLocaleDateString("en-GB");
        }

        if (
          params.column.getColId() === "trade_timestamp" ||
          params.column.getColId() === "created_at" ||
          params.column.getColId() === "updated_at"
        ) {
          return new Date(params.value).toLocaleString("en-GB", { hour12: false });
        }
      }

      return params.value ?? "";
    }

    const isDecimalColumn =
      params.column.getColId() === "price" || params.column.getColId() === "notional";

    return isDecimalColumn ? formatDecimal(params.value) : formatInteger(params.value);
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
  "Pagination buttons move through the static trades dataset page by page; filters affect only the current page in this mock setup.",
];

export function PortfolioTradesTable({
  portfolioId,
  trades,
  collapsed,
  onToggle,
  onSaveTrade,
}: {
  portfolioId: string;
  trades: PortfolioTrade[];
  collapsed: boolean;
  onToggle: () => void;
  onSaveTrade: (trade: CreateTradeRequest, amendTradeId?: string) => Promise<void>;
}) {
  const gridApiRef = useRef<GridApi<PortfolioTrade> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);
  const [selectedTrade, setSelectedTrade] = useState<PortfolioTrade | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formSeed, setFormSeed] = useState(0);
  const normalizedTrades = useMemo(
    () => trades.map((trade) => normalizeTrade(trade as PortfolioTrade | Record<string, unknown>)),
    [trades],
  );
  const totalRows = normalizedTrades.length;
  const lastPage = Math.max(1, Math.ceil(totalRows / PAGE_SIZE));
  const currentRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return normalizedTrades.slice(start, start + PAGE_SIZE);
  }, [currentPage, normalizedTrades]);
  const hasPrev = currentPage > 1;
  const hasNext = currentPage < lastPage;

  function handleFitColumnsToHeader() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const cols = api.getColumns?.() ?? api.getAllDisplayedColumns();
    const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
    api.autoSizeColumns?.(colIds, false);
  }

  function handleFitColumnsToData() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }
    const cols = api.getColumns?.() ?? api.getAllDisplayedColumns();
    const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
    api.autoSizeColumns?.(colIds, true);
  }

  function handleDownloadCsv() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    api.exportDataAsCsv({
      fileName: `${portfolioId.toLowerCase()}-trades.csv`,
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
    setSelectedTrade(null);
  }

  function handleOpenTradeForm() {
    setFormSeed((seed) => seed + 1);
    setIsFormOpen(true);
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
    <DashboardCardShell
      title="Trades"
      collapsed={collapsed}
      onToggle={onToggle}
      expandedClassName="h-[780px] shrink-0"
    >
      <div className="mb-4 mt-3 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-[color:var(--color-muted)]">
          <button
            type="button"
            onClick={handleOpenTradeForm}
            className="inline-flex shrink-0 items-center justify-center rounded-md border border-[color:var(--color-accent)] px-3 py-1 text-sm font-medium text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/10"
            title={selectedTrade ? "Amend selected trade" : "Add new trade"}
          >
            {selectedTrade ? "Amend" : "Add"}
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
              <path d="M18 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M12 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <path d="M15 18l-6-6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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
              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
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

      <div className="min-h-0 flex-1 w-full">
        <HelixAgTable
          rowData={currentRows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="trade_id"
          onGridReady={(event: GridReadyEvent<PortfolioTrade>) => {
            gridApiRef.current = event.api;
          }}
          onSelectionChanged={(event: SelectionChangedEvent<PortfolioTrade>) => {
            const selectedRows = event.api.getSelectedRows();
            setSelectedCount(selectedRows.length);
            setSelectedTrade(selectedRows[0] ?? null);
          }}
          onCellDoubleClicked={(event: CellDoubleClickedEvent<PortfolioTrade>) => {
            if (!event.node) {
              return;
            }
            event.node.setSelected(!event.node.isSelected());
            const selectedRows = event.api.getSelectedRows();
            setSelectedCount(selectedRows.length);
            setSelectedTrade(selectedRows[0] ?? null);
          }}
          onFilterChanged={(event: FilterChangedEvent<PortfolioTrade>) => {
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
            suppressColumnVirtualisation: true,
          }}
        />
      </div>
      <TradeFormModal
        key={`${selectedTrade?.trade_id ?? "new"}-${portfolioId}-${formSeed}`}
        open={isFormOpen}
        portfolioId={portfolioId}
        trade={selectedTrade}
        onClose={() => setIsFormOpen(false)}
        onSave={async (trade) => {
          await onSaveTrade(trade, selectedTrade?.trade_id);
          setIsFormOpen(false);
          setSelectedTrade(null);
          setSelectedCount(0);
        }}
      />
    </DashboardCardShell>
  );
}
