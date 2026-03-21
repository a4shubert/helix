"use client";

import type { ColDef, GridApi, GridReadyEvent } from "ag-grid-community";
import { useEffect, useRef } from "react";
import { DashboardCardShell } from "@/components/dashboard/DashboardCardShell";
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

  function handleDownloadCsv() {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    api.exportDataAsCsv({
      fileName: "market-data.csv",
    });
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      handleFitColumnsToData();
    });
    return () => cancelAnimationFrame(frame);
  }, [rows]);

  return (
    <DashboardCardShell
      title="Market Data"
      subtitle={asOf ? `(${new Date(asOf).toLocaleString("en-GB", { hour12: false }).replaceAll(",", "")})` : undefined}
      collapsed={collapsed}
      onToggle={onToggle}
      expandedClassName="h-[460px] shrink-0"
    >
      <div className="mb-4 mt-3 flex flex-wrap items-center gap-4 text-sm text-[color:var(--color-muted)]">
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
        <span>Rows: {rows.length}</span>
      </div>
      <div className="min-h-0 flex-1 w-full">
        <HelixAgTable
          rowData={rows}
          columnDefs={columnDefs}
          defaultColDef={defaultColDef}
          rowIdField="instrumentId"
          onGridReady={(event: GridReadyEvent<MarketDataRow>) => {
            gridApiRef.current = event.api;
            requestAnimationFrame(() => {
              handleFitColumnsToData();
            });
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
