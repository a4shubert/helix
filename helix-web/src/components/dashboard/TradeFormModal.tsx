"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  fetchTradeFormOptions,
  type CreateTradeRequest,
  type TradeFormInstrumentOption,
  type TradeFormOptionsResponse,
} from "@/lib/api/helix";
import type { PortfolioTrade } from "@/lib/api/types";
import { formatUkDate, parseUkDateToIso } from "@/lib/format/date";
import { formatDecimal } from "@/lib/format/number";

type TradeFormValues = {
  asset_class: string;
  instrument_id: string;
  side: string;
  quantity: string;
  price: string;
  settlement_date: string;
  book: string;
};

function toFormValues(_portfolioId: string, trade?: PortfolioTrade | null): TradeFormValues {
  return {
    asset_class: trade?.asset_class ?? "",
    instrument_id: trade?.instrument_id ?? "",
    side: trade?.side ?? "BUY",
    quantity: trade ? String(trade.quantity) : "",
    price: trade ? String(trade.price) : "",
    settlement_date: formatUkDate(trade?.settlement_date ?? "2026-03-23"),
    book: trade?.book ?? "",
  };
}

const emptyOptions: TradeFormOptionsResponse = {
  assetClasses: [],
  instruments: [],
  books: [],
};

const formControlClass =
  "h-14 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 text-white outline-none focus:border-[color:var(--color-accent)]";

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
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    setForm(toFormValues(portfolioId, trade));
    setIsSaving(false);
    setLoadError(null);
    setFormError(null);
  }, [open, portfolioId, trade]);

  useEffect(() => {
    if (!open) {
      return;
    }

    let isCancelled = false;
    setIsLoadingOptions(true);
    setLoadError(null);
    setFormError(null);

    void fetchTradeFormOptions()
      .then((response) => {
        if (isCancelled) {
          return;
        }
        setOptions(response);
        setForm((current) => {
          const assetClass = current.asset_class || response.assetClasses[0] || "";
          const filteredInstruments = response.instruments.filter(
            (instrument) => instrument.assetClass === assetClass,
          );
          const nextInstrumentId =
            current.instrument_id &&
            filteredInstruments.some((instrument) => instrument.instrumentId === current.instrument_id)
              ? current.instrument_id
              : filteredInstruments[0]?.instrumentId ?? "";

          return {
            ...current,
            asset_class: assetClass,
            instrument_id: nextInstrumentId,
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

  const filteredInstruments = useMemo(
    () =>
      options.instruments.filter((instrument) =>
        form.asset_class ? instrument.assetClass === form.asset_class : true,
      ),
    [form.asset_class, options.instruments],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm((current) => {
      if (
        current.instrument_id &&
        filteredInstruments.some((instrument) => instrument.instrumentId === current.instrument_id)
      ) {
        return current;
          }

      return {
        ...current,
        instrument_id: filteredInstruments[0]?.instrumentId ?? "",
      };
    });
  }, [filteredInstruments, open]);

  const selectedInstrument = useMemo<TradeFormInstrumentOption | null>(
    () => options.instruments.find((instrument) => instrument.instrumentId === form.instrument_id) ?? null,
    [form.instrument_id, options.instruments],
  );
  const latestMarketPrice = selectedInstrument?.marketPrice;

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
    const settlementDate = parseUkDateToIso(form.settlement_date);
    if (!settlementDate) {
      setFormError("Settlement Date must be in DD/MM/YYYY format.");
      return;
    }

    const quantity = Number(form.quantity) || 0;
    const price = Number(form.price) || 0;

    setFormError(null);
    setIsSaving(true);
    try {
      await onSave({
        portfolioId,
        instrumentId: selectedInstrument.instrumentId,
        side: form.side,
        quantity,
        price,
        settlementDate,
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
        {formError && (
          <div className="mb-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {formError}
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm text-white">Asset Class</span>
              <select
                value={form.asset_class}
                onChange={(event) => updateField("asset_class", event.target.value)}
                className={formControlClass}
                required
                disabled={isLoadingOptions || options.assetClasses.length === 0}
              >
                <option value="">Select asset class</option>
                {options.assetClasses.map((assetClass) => (
                  <option key={assetClass} value={assetClass}>
                    {assetClass}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Instrument</span>
              <select
                value={form.instrument_id}
                onChange={(event) => updateField("instrument_id", event.target.value)}
                className={formControlClass}
                required
                disabled={isLoadingOptions || filteredInstruments.length === 0}
              >
                <option value="">Select instrument</option>
                {filteredInstruments.map((instrument) => (
                  <option key={instrument.instrumentId} value={instrument.instrumentId}>
                    {instrument.instrumentName}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Latest Market Price</span>
              <input
                type="text"
                readOnly
                value={latestMarketPrice == null ? "N/A" : formatDecimal(latestMarketPrice)}
                className="h-14 w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-4 py-3 text-white/90 outline-none"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Side</span>
              <select
                value={form.side}
                onChange={(event) => updateField("side", event.target.value)}
                className={formControlClass}
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
                className={formControlClass}
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
                className={formControlClass}
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Book</span>
              <select
                value={form.book}
                onChange={(event) => updateField("book", event.target.value)}
                className={formControlClass}
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
            <label className="space-y-2">
              <span className="text-sm text-white">Settlement Date</span>
              <input
                type="text"
                value={form.settlement_date}
                onChange={(event) => updateField("settlement_date", event.target.value)}
                className={formControlClass}
                placeholder="DD/MM/YYYY"
                inputMode="numeric"
                required
              />
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
