"use client";

import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { formatDecimal } from "@/lib/format/number";
import type { PortfolioTrade } from "@/lib/mock/trades";

type TradeFormValues = {
  trade_id: string;
  position_id: string;
  instrument_id: string;
  instrument_name: string;
  asset_class: string;
  currency: string;
  side: string;
  quantity: string;
  price: string;
  contract_multiplier: string;
  trade_timestamp: string;
  settlement_date: string;
  strategy: string;
  book: string;
  desk: string;
  status: string;
};

function createGeneratedTradeId(portfolioId: string): string {
  return `TRD-${portfolioId}-${Date.now()}`;
}

function createGeneratedPositionId(portfolioId: string): string {
  return `${portfolioId}-POS-${Date.now()}`;
}

function toFormValues(portfolioId: string, trade?: PortfolioTrade | null): TradeFormValues {
  return {
    trade_id: trade?.trade_id ?? createGeneratedTradeId(portfolioId),
    position_id: trade?.position_id ?? createGeneratedPositionId(portfolioId),
    instrument_id: trade?.instrument_id ?? "",
    instrument_name: trade?.instrument_name ?? "",
    asset_class: trade?.asset_class ?? "",
    currency: trade?.currency ?? "USD",
    side: trade?.side ?? "BUY",
    quantity: trade ? String(trade.quantity) : "",
    price: trade ? String(trade.price) : "",
    contract_multiplier: trade ? String(trade.contract_multiplier) : "1",
    trade_timestamp: trade?.trade_timestamp ?? "2026-03-21T09:30:00Z",
    settlement_date: trade?.settlement_date ?? "2026-03-23",
    strategy: trade?.strategy ?? "",
    book: trade?.book ?? "",
    desk: trade?.desk ?? "",
    status: trade?.status ?? "processed",
  };
}

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
  onSave: (trade: PortfolioTrade) => void;
}) {
  const [form, setForm] = useState<TradeFormValues>(() => toFormValues(portfolioId, trade));

  const computedNotional = useMemo(() => {
    const quantity = Number(form.quantity) || 0;
    const price = Number(form.price) || 0;
    const contractMultiplier = Number(form.contract_multiplier) || 0;
    return quantity * price * contractMultiplier;
  }, [form.contract_multiplier, form.price, form.quantity]);

  if (!open) {
    return null;
  }

  function updateField<K extends keyof TradeFormValues>(field: K, value: TradeFormValues[K]) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const now = "2026-03-21T09:30:00Z";
    const quantity = Number(form.quantity) || 0;
    const price = Number(form.price) || 0;
    const contractMultiplier = Number(form.contract_multiplier) || 1;
    const normalizedPositionId = form.position_id.trim().startsWith(`${portfolioId}-`)
      ? form.position_id.trim()
      : `${portfolioId}-${form.position_id.trim()}`;

    onSave({
      trade_id: form.trade_id.trim(),
      portfolio_id: portfolioId,
      position_id: normalizedPositionId,
      instrument_id: form.instrument_id.trim(),
      instrument_name: form.instrument_name.trim(),
      asset_class: form.asset_class.trim(),
      currency: form.currency.trim().toUpperCase(),
      side: form.side,
      quantity,
      price,
      contract_multiplier: contractMultiplier,
      notional: quantity * price * contractMultiplier,
      trade_timestamp: form.trade_timestamp,
      settlement_date: form.settlement_date,
      strategy: form.strategy.trim(),
      book: form.book.trim(),
      desk: form.desk.trim(),
      status: form.status.trim(),
      version: trade ? trade.version + 1 : 1,
      parent_trade_id: trade?.parent_trade_id ?? null,
      created_at: trade?.created_at ?? now,
      updated_at: now,
    });
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

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="space-y-2">
              <span className="text-sm text-white">Trade ID</span>
              <input
                value={form.trade_id}
                onChange={(event) => updateField("trade_id", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Position ID</span>
              <input
                value={form.position_id}
                onChange={(event) => updateField("position_id", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Instrument ID</span>
              <input
                value={form.instrument_id}
                onChange={(event) => updateField("instrument_id", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Instrument Name</span>
              <input
                value={form.instrument_name}
                onChange={(event) => updateField("instrument_name", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Asset Class</span>
              <input
                value={form.asset_class}
                onChange={(event) => updateField("asset_class", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Currency</span>
              <input
                value={form.currency}
                onChange={(event) => updateField("currency", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
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
              <span className="text-sm text-white">Contract Multiplier</span>
              <input
                type="number"
                step="any"
                value={form.contract_multiplier}
                onChange={(event) => updateField("contract_multiplier", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Trade Timestamp</span>
              <input
                type="datetime-local"
                value={form.trade_timestamp.replace("Z", "")}
                onChange={(event) =>
                  updateField(
                    "trade_timestamp",
                    event.target.value.endsWith("Z") ? event.target.value : `${event.target.value}Z`,
                  )
                }
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
            <label className="space-y-2">
              <span className="text-sm text-white">Status</span>
              <input
                value={form.status}
                onChange={(event) => updateField("status", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm text-white">Strategy</span>
              <input
                value={form.strategy}
                onChange={(event) => updateField("strategy", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Book</span>
              <input
                value={form.book}
                onChange={(event) => updateField("book", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm text-white">Desk</span>
              <input
                value={form.desk}
                onChange={(event) => updateField("desk", event.target.value)}
                className="w-full rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white outline-none focus:border-[color:var(--color-accent)]"
                required
              />
            </label>
            <div className="space-y-2">
              <span className="text-sm text-white">Computed Notional</span>
              <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-bg)] px-3 py-2 text-white">
                {formatDecimal(computedNotional)}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[color:var(--color-border)] px-4 py-2 text-white hover:border-[color:var(--color-accent)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-lg border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-4 py-2 text-[color:var(--color-accent)] hover:bg-[color:var(--color-accent)]/20"
            >
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
