# helix-core

Core analytics library for the Helix platform.

## Organization

- `helix_core.trades`
  - trade-level calculations such as signed quantity and trade notional
- `helix_core.portfolio`
  - position rebuilding plus portfolio P&L and risk aggregation
- `helix_core.valuation`
  - pluggable P&L / inventory valuation models such as `average_cost`, `fifo`, and `lifo`
- `helix_core.risk`
  - portfolio risk models such as `standard`

## Minimal example

```python
from datetime import UTC, datetime
from helix_core import MarketInput, Trade, compute_portfolio_analytics

trades = [
    Trade(
        trade_id="TRD-1",
        portfolio_id="PF-001",
        position_id="PF-001-POS-001",
        instrument_id="AAPL",
        instrument_name="Apple Inc.",
        asset_class="Equity",
        currency="USD",
        side="BUY",
        quantity=100,
        price=200.0,
        trade_timestamp=datetime(2026, 3, 21, 9, 30, tzinfo=UTC),
        settlement_date=None,
        book="Equity",
        status="processed",
        version=1,
    )
]

market_inputs = {
    "AAPL": MarketInput(
        instrument_id="AAPL",
        market_price=212.5,
        volatility=0.25,
        market_data_timestamp=datetime(2026, 3, 21, 9, 31, tzinfo=UTC),
    )
}

analytics = compute_portfolio_analytics("PF-001", trades, market_inputs)
print(analytics.pnl.total_pnl)
print(analytics.risk.var_95)
```

Select a different valuation model:

```python
analytics = compute_portfolio_analytics(
    "PF-001",
    trades,
    market_inputs,
    pnl_model="fifo",
)
```

Select a risk model:

```python
analytics = compute_portfolio_analytics(
    "PF-001",
    trades,
    market_inputs,
    risk_model="standard",
)
```

A Jupyter example is available at `notebooks/helix_core_demo.ipynb`.
