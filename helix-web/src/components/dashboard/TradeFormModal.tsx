"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchTradeFormOptions,
  type CreateTradeRequest,
  type TradeFormInstrumentOption,
  type TradeFormOptionsResponse,
} from "@/lib/api/helix";
import type { PortfolioTrade } from "@/lib/mock/trades";

type TradeFormValues = {
  instrument_id: string;
  side: string;
  quantity: string;
  price: string;
  settlement_date: string;
  book: string;
};

function toFormValues(_portfolioId: string, trade?: PortfolioTrade | null): TradeFormValues {
  return {
    instrument_id: trade?.instrument_id ?? "",
    side: trade?.side ?? "BUY",
    quantity: trade ? String(trade.quantity) : "",
    price: trade ? String(trade.price) : "",
    settlement_date: trade?.settlement_date ?? "2026-03-23",
    book: trade?.book ?? "",
  };
}

const emptyOptions: TradeFormOptionsResponse = {
  instruments: [],
  books: [],
};

export function TradeFormModal({
  open,
  portfolioId,
  trade,
  onClose,
  onSave,
}: {
  open: boolean;
  portfolioId: string;
  trade?: PortfolioTrade | null;
  onClose: () => void;
  onSave: (trade: CreateTradeRequest) => Promise<void>;
}) {
  const [form, setForm] = useState<TradeFormValues>(() => toFormValues(portfolioId, trade));
  const [options, setOptions] = useState<TradeFormOptionsResponse>(emptyOptions);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(toFormValues(portfolioId, trade));
    setIsSaving(false);
    setLoadError(null);
  }, [open, portfolioId, trade]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;
    setIsLoadingOptions(true);
    setLoadError(null);

    void fetchTradeFormOptions()
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setOptions(response);
        setForm((current) => {
          if (current.instrument_id || response.instruments.length === 0) {
            return current;
          }
          return {
            ...current,
            instrument_id: response.instruments[0].instrumentId,
          };
        });
      })
      .catch((error) => {
        if (isCancelled) {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "Failed to load trade form options.");
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingOptions(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [open]);

  const selectedInstrument = useMemo<TradeFormInstrumentOption | null>(
    () => options.instruments.find((instrument) => instrument.instrumentId === form.instrument_id) ?? null,
    [form.instrument_id, options.instruments],
  );

  if (!open) {
    return null;
  }

  function updateField<K extends keyof TradeFormValues>(field: K, value: TradeFormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedInstrument) {
      return;
    }

    const quantity = Number(form.quantity) || 0;
    const price = Number(form.price) || 0;

    setIsSaving(true);
    try {
      await onSave({
        portfolioId,
        instrumentId: selectedInstrument.instrumentId,
        side: form.side,
        quantity,
        price,
        settlementDate: form.settlement_date,
        book: form.book.trim(),
        version: trade ? trade.version + 1 : 1,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4">
      <div className="w-full max-w-5xl rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(2,6,23,0.55)]">
        <div className="mb-5 flex items-center justify-between gap-4">
          <div>
            <div className="text-xl font-semibold uppercase tracking-[0.18em] text-[color:var(--color-accent)]">
              {trade ? "Amend Trade" : "New Trade"}
            </div>
            <div className="mt-1 text-sm text-[color:var(--color-muted)]">{portfolioId}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border)] bg-[color:var(--color-bg)] text-2xl font-light text-white hover:border-[color:var(--color-accent)] hover:text-[color:var(--color-accent)]"
            title="Close"
          >
            ×
          </button>
        </div>

        {loadError && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {loadError}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2 xl:col-span-4">
              <span className="text-sm text-white">Instrument</span>
              <select
                value={form.instrument_id}
                onChange={(event) => updateField("instrument_id", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
                disabled={isLoadingOptions || options.instruments.length === 0}
              >
                <option value="">Select instrument</option>
                {options.instruments.map((instrument) => (
                  <option key={instrument.instrumentId} value={instrument.instrumentId}>
                    {instrument.instrumentName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Asset Class</span>
              <input
                value={selectedInstrument?.assetClass ?? ""}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none"
                readOnly
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Side</span>
              <select
                value={form.side}
                onChange={(event) => updateField("side", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
              >
                <option value="BUY">BUY</option>
                <option value="SELL">SELL</option>
              </select>
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Quantity</span>
              <input
                type="number"
                step="any"
                value={form.quantity}
                onChange={(event) => updateField("quantity", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Price</span>
              <input
                type="number"
                step="any"
                value={form.price}
                onChange={(event) => updateField("price", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Settlement Date</span>
              <input
                type="date"
                value={form.settlement_date}
                onChange={(event) => updateField("settlement_date", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2 xl:col-span-2">
              <span className="text-sm text-white">Book</span>
              <select
                value={form.book}
                onChange={(event) => updateField("book", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
                disabled={isLoadingOptions}
              >
                <option value="">Select book</option>
                {options.books.map((book) => (
                  <option key={book} value={book}>
                    {book}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 border-t border-[color:var(--color-border)] pt-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-sm text-white hover:border-[color:var(--color-accent)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || isLoadingOptions || !selectedInstrument}
              className="rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm font-medium text-slate-950 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
