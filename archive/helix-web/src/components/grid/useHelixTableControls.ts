"use client";

import type { GridApi } from "ag-grid-community";
import { useEffect, useRef, useState } from "react";

type UseHelixTableControlsOptions = {
  csvFileName: string;
  autoFitToken: unknown;
  onClearSelection?: () => void;
};

export function useHelixTableControls<T extends Record<string, unknown>>({
  csvFileName,
  autoFitToken,
  onClearSelection,
}: UseHelixTableControlsOptions) {
  const gridApiRef = useRef<GridApi<T> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [visibleStart, setVisibleStart] = useState(0);
  const [visibleEnd, setVisibleEnd] = useState(0);
  const [visibleTotalRows, setVisibleTotalRows] = useState(0);
  const [selectedCount, setSelectedCount] = useState(0);
  const [hasFilters, setHasFilters] = useState(false);

  function getLiveApi() {
    const api = gridApiRef.current;
    if (!api) {
      return null;
    }
    if (api.isDestroyed?.()) {
      gridApiRef.current = null;
      return null;
    }
    return api;
  }

  function refreshPaginationState(api: GridApi<T>) {
    if (api.isDestroyed?.()) {
      return;
    }
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

  function withApi(action: (api: GridApi<T>) => void) {
    const api = getLiveApi();
    if (!api) {
      return;
    }
    action(api);
  }

  function fitColumns(skipHeaderOnAutoSize: boolean) {
    withApi((api) => {
      const cols = api.getColumns?.() ?? api.getAllDisplayedColumns?.() ?? [];
      const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
      if (colIds.length === 0) {
        return;
      }
      api.autoSizeColumns?.(colIds, skipHeaderOnAutoSize);
    });
  }

  function handleFitColumnsToHeader() {
    fitColumns(false);
  }

  function handleFitColumnsToData() {
    fitColumns(true);
  }

  function handleDownloadCsv() {
    withApi((api) => {
      api.exportDataAsCsv({
        fileName: csvFileName,
      });
    });
  }

  function handleResetFilters() {
    withApi((api) => {
      api.setFilterModel(null);
      api.onFilterChanged?.();
      setHasFilters(false);
      api.paginationGoToFirstPage?.();
      refreshPaginationState(api);
    });
  }

  function handleGoToFirstPage() {
    withApi((api) => {
      api.paginationGoToFirstPage?.();
      refreshPaginationState(api);
    });
  }

  function handleGoToPreviousPage() {
    withApi((api) => {
      api.paginationGoToPreviousPage?.();
      refreshPaginationState(api);
    });
  }

  function handleGoToNextPage() {
    withApi((api) => {
      api.paginationGoToNextPage?.();
      refreshPaginationState(api);
    });
  }

  function handleGoToLastPage() {
    withApi((api) => {
      api.paginationGoToLastPage?.();
      refreshPaginationState(api);
    });
  }

  function handleClearSelection() {
    withApi((api) => {
      api.deselectAll();
    });
    setSelectedCount(0);
    onClearSelection?.();
  }

  function handleFilterChanged(api: GridApi<T>) {
    const filterModel = api.getFilterModel();
    setHasFilters(Object.keys(filterModel ?? {}).length > 0);
    api.paginationGoToFirstPage?.();
    refreshPaginationState(api);
  }

  function handleSelectionCountChanged(api: GridApi<T>) {
    setSelectedCount(api.getSelectedNodes().length);
  }

  function attachApi(api: GridApi<T>) {
    gridApiRef.current = api;
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const api = getLiveApi();
      if (!api) {
        return;
      }

      const cols = api.getColumns?.() ?? api.getAllDisplayedColumns?.() ?? [];
      const colIds = cols.map((column) => column.getColId?.()).filter(Boolean) as string[];
      if (colIds.length > 0) {
        api.autoSizeColumns?.(colIds, true);
      }

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
    });
    return () => {
      cancelAnimationFrame(frame);
      const api = gridApiRef.current;
      if (api?.isDestroyed?.()) {
        gridApiRef.current = null;
      }
    };
  }, [autoFitToken]);

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
      const api = getLiveApi();
      if (!api) {
        return;
      }

      api.setFilterModel(null);
      api.onFilterChanged?.();
      setHasFilters(false);
      api.paginationGoToFirstPage?.();

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

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasFilters]);

  return {
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
  };
}
