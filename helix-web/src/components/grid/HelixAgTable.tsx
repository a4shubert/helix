"use client";

import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";

import { AllCommunityModule, ModuleRegistry } from "ag-grid-community";
import type {
  CellClickedEvent,
  CellDoubleClickedEvent,
  CellKeyDownEvent,
  ColDef,
  FilterChangedEvent,
  GridApi,
  GridOptions,
  GridReadyEvent,
  SelectionChangedEvent,
  SortChangedEvent,
} from "ag-grid-community";
import { AgGridReact } from "ag-grid-react";
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useMemo, useRef } from "react";

let agGridRegistered = false;
if (!agGridRegistered) {
  ModuleRegistry.registerModules([AllCommunityModule]);
  agGridRegistered = true;
}

export type HelixAgTableProps<T extends Record<string, unknown>> = {
  rowData: T[];
  columnDefs?: ColDef<T>[];
  defaultColDef?: ColDef<T>;
  className?: string;
  height?: number | string;
  loading?: boolean;
  error?: string | null;
  gridOptions?: GridOptions<T>;
  rowIdField?: Extract<keyof T, string>;
  onGridReady?: (event: GridReadyEvent<T>) => void;
  onFilterChanged?: (event: FilterChangedEvent<T>) => void;
  onSortChanged?: (event: SortChangedEvent<T>) => void;
  onSelectionChanged?: (event: SelectionChangedEvent<T>) => void;
  onCellClicked?: (event: CellClickedEvent<T>) => void;
  onCellDoubleClicked?: (event: CellDoubleClickedEvent<T>) => void;
  onCellKeyDown?: (event: CellKeyDownEvent<T>) => void;
  onFilterPaste?: (colId: string) => void;
};

export function HelixAgTable<T extends Record<string, unknown>>({
  rowData,
  columnDefs,
  defaultColDef: defaultColDefProp,
  className,
  height = "100%",
  loading,
  error,
  gridOptions,
  rowIdField,
  onGridReady,
  onFilterChanged,
  onSortChanged,
  onSelectionChanged,
  onCellClicked,
  onCellDoubleClicked,
  onCellKeyDown,
  onFilterPaste,
}: HelixAgTableProps<T>) {
  const gridApiRef = useRef<GridApi<T> | null>(null);
  const columnFilterTypeByColId = useMemo(() => {
    const map = new Map<string, unknown>();
    for (const def of columnDefs ?? []) {
      const colId = (def.colId ?? def.field) as string | undefined;
      if (!colId) {
        continue;
      }
      map.set(colId, def.filter);
    }
    return map;
  }, [columnDefs]);

  async function copyText(text: string) {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return;
      }
    } catch {
      // Fall back to textarea copy below.
    }

    const el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "true");
    el.style.position = "fixed";
    el.style.top = "-9999px";
    document.body.appendChild(el);
    el.select();
    document.execCommand("copy");
    document.body.removeChild(el);
  }

  function handleCellKeyDown(e: CellKeyDownEvent<T>) {
    onCellKeyDown?.(e);

    const ev = e.event as KeyboardEvent | undefined;
    if (!ev) {
      return;
    }

    const key = ev.key?.toLowerCase();
    const isCopy = (ev.metaKey || ev.ctrlKey) && key === "c" && !ev.shiftKey && !ev.altKey;
    if (!isCopy) {
      return;
    }

    const value = e.value;
    if (value === null || value === undefined) {
      return;
    }

    ev.preventDefault();
    void copyText(typeof value === "string" ? value : String(value));
  }

  function findFloatingFilterColumnId(target: EventTarget | null): string | null {
    if (!target || !(target instanceof HTMLElement)) {
      return null;
    }

    const direct = target.closest("[col-id]")?.getAttribute("col-id");
    if (direct && direct.length) {
      return direct;
    }

    const floating = target.closest(".ag-floating-filter");
    if (!floating) {
      return null;
    }

    const headerCell = target.closest(".ag-header-cell");
    const colId = headerCell?.getAttribute("col-id");
    return colId && colId.length ? colId : null;
  }

  function parseDateFromText(input: string) {
    const text = input.trim();
    if (!text) {
      return null;
    }

    const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(text);
    if (isoMatch) {
      return isoMatch[1];
    }

    const ms = Date.parse(text);
    if (!Number.isFinite(ms)) {
      return null;
    }

    const d = new Date(ms);
    const yyyy = String(d.getFullYear()).padStart(4, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }

  function setEqualsForTextFilter(colId: string, filterText?: string) {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    const model = (api.getFilterModel() as Record<string, { filter?: string; type?: string; filterType?: string }>) ?? {};
    const existing = model[colId];
    const nextText = typeof filterText === "string" ? filterText : existing?.filter;
    if (typeof nextText !== "string") {
      return;
    }

    const trimmed = nextText.trim();
    if (!trimmed) {
      return;
    }

    if (existing?.type?.toLowerCase() === "equals" && existing.filter?.trim() === trimmed) {
      return;
    }

    api.setFilterModel({
      ...model,
      [colId]: {
        ...(existing ?? {}),
        filterType: existing?.filterType ?? "text",
        type: "equals",
        filter: trimmed,
      },
    });
    api.onFilterChanged?.();
  }

  function setEqualsForDateFilter(colId: string, filterText?: string) {
    const api = gridApiRef.current;
    if (!api) {
      return;
    }

    const model = (api.getFilterModel() as Record<string, { dateFrom?: string; type?: string }>) ?? {};
    const existing = model[colId];
    const nextText = typeof filterText === "string" ? filterText : existing?.dateFrom;
    if (typeof nextText !== "string") {
      return;
    }

    const dateFrom = parseDateFromText(nextText);
    if (!dateFrom) {
      return;
    }

    if (existing?.type?.toLowerCase() === "equals" && existing.dateFrom?.trim() === dateFrom) {
      return;
    }

    api.setFilterModel({
      ...model,
      [colId]: {
        ...(existing ?? {}),
        filterType: "date",
        type: "equals",
        dateFrom,
      },
    });
    api.onFilterChanged?.();
  }

  function getPreferredFilterType(colId: string) {
    const api = gridApiRef.current;
    const model = (api?.getFilterModel() as Record<string, { filterType?: string }>) ?? {};
    const existingFilterType = model[colId]?.filterType;
    if (existingFilterType) {
      return existingFilterType;
    }

    const colFilter = columnFilterTypeByColId.get(colId);
    if (colFilter === "agDateColumnFilter") {
      return "date";
    }
    if (colFilter === "agNumberColumnFilter") {
      return "number";
    }
    return "text";
  }

  function getFocusedCellText(): string | null {
    const api = gridApiRef.current;
    if (!api) {
      return null;
    }

    const focused = api.getFocusedCell?.();
    if (!focused) {
      return null;
    }

    const rowNode = api.getDisplayedRowAtIndex?.(focused.rowIndex);
    const colId = focused.column?.getColId?.();
    if (!rowNode || !colId) {
      return null;
    }

    const value = (rowNode.data as Record<string, unknown> | undefined)?.[colId];
    if (value === null || value === undefined) {
      return null;
    }
    return typeof value === "string" ? value : String(value);
  }

  function handleKeyDownCapture(ev: ReactKeyboardEvent) {
    const key = ev.key?.toLowerCase();
    const isCopy = (ev.metaKey || ev.ctrlKey) && key === "c" && !ev.shiftKey && !ev.altKey;
    const isPaste = (ev.metaKey || ev.ctrlKey) && key === "v" && !ev.shiftKey && !ev.altKey;

    if (!isCopy && !isPaste) {
      return;
    }

    const colId = findFloatingFilterColumnId(ev.target);
    if (!colId) {
      if (isCopy) {
        const text = getFocusedCellText();
        if (!text) {
          return;
        }
        ev.preventDefault();
        void copyText(text);
      }
      return;
    }

    if (isPaste) {
      onFilterPaste?.(colId);
      window.setTimeout(() => {
        const target = ev.target;
        const value =
          target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
            ? target.value
            : undefined;
        const filterType = getPreferredFilterType(colId);
        if (filterType === "date") {
          setEqualsForDateFilter(colId, value);
          return;
        }
        setEqualsForTextFilter(colId, value);
      }, 40);
      return;
    }

    const text = getFocusedCellText();
    if (!text) {
      return;
    }
    ev.preventDefault();
    void copyText(text);
  }

  function handlePasteCapture(ev: React.ClipboardEvent) {
    const colId = findFloatingFilterColumnId(ev.target);
    if (!colId) {
      return;
    }

    onFilterPaste?.(colId);
    window.setTimeout(() => {
      const target = ev.target;
      const value =
        target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
          ? target.value
          : undefined;
      const filterType = getPreferredFilterType(colId);
      if (filterType === "date") {
        setEqualsForDateFilter(colId, value);
        return;
      }
      setEqualsForTextFilter(colId, value);
    }, 40);
  }

  const autoColumnDefs = useMemo<ColDef<T>[]>(() => {
    if (columnDefs?.length) {
      return columnDefs;
    }

    const keys = Object.keys(rowData[0] ?? {});
    return keys.map((field) => ({ field })) as ColDef<T>[];
  }, [columnDefs, rowData]);

  const defaultColDef = useMemo<ColDef<T>>(
    () => ({
      resizable: true,
      suppressMovable: false,
      sortable: true,
      unSortIcon: true,
      filter: true,
      floatingFilter: true,
      minWidth: 90,
      ...(defaultColDefProp ?? {}),
    }),
    [defaultColDefProp],
  );

  const mergedGridOptions = useMemo<GridOptions<T>>(
    () => ({
      theme: "legacy",
      animateRows: true,
      suppressCellFocus: false,
      pagination: false,
      suppressMovableColumns: false,
      alwaysShowHorizontalScroll: true,
      suppressHorizontalScroll: false,
      enableCellTextSelection: true,
      ensureDomOrder: true,
      rowSelection:
        gridOptions?.rowSelection ?? {
          mode: "singleRow",
          enableClickSelection: false,
        },
      ...(gridOptions ?? {}),
    }),
    [gridOptions],
  );

  const finalClassName = [
    "helix-ag-grid ag-theme-quartz-dark w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-card)]",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const gridContainerStyle = useMemo(
    () =>
      ({
        height: "100%",
        "--ag-border-color": "rgba(255, 255, 255, 0.16)",
        "--ag-secondary-border-color": "rgba(255, 255, 255, 0.12)",
        "--ag-header-column-resize-handle-color": "rgba(255, 255, 255, 0.65)",
        "--ag-header-column-resize-handle-width": "4px",
        "--ag-header-column-resize-handle-height": "60%",
      }) as CSSProperties,
    [],
  );

  return (
    <div
      className="w-full"
      style={{ height }}
      onKeyDownCapture={handleKeyDownCapture}
      onPasteCapture={handlePasteCapture}
    >
      {error ? (
        <div className="mb-3 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className={finalClassName} style={gridContainerStyle}>
        <style jsx global>{`
          .helix-ag-grid .ag-header-cell-resize {
            cursor: col-resize;
          }
          .helix-ag-grid .ag-header-cell-resize::after {
            cursor: col-resize;
          }
        `}</style>
        <AgGridReact<T>
          rowData={rowData}
          columnDefs={autoColumnDefs}
          defaultColDef={defaultColDef}
          gridOptions={mergedGridOptions}
          loading={loading}
          onGridReady={(event) => {
            gridApiRef.current = event.api;
            onGridReady?.(event);
          }}
          onFilterChanged={onFilterChanged}
          onSortChanged={onSortChanged}
          onSelectionChanged={onSelectionChanged}
          onCellClicked={onCellClicked}
          onCellDoubleClicked={onCellDoubleClicked}
          onCellKeyDown={handleCellKeyDown}
          getRowId={
            rowIdField
              ? (params) => {
                  const raw = params.data?.[rowIdField];
                  if (typeof raw === "string" && raw.length) {
                    return raw;
                  }
                  if (typeof raw === "number") {
                    return String(raw);
                  }
                  return JSON.stringify(params.data);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
