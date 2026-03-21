# helix-core

Core analytics library for the Helix platform.

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
        contract_multiplier=1.0,
        trade_timestamp=datetime(2026, 3, 21, 9, 30, tzinfo=UTC),
        settlement_date=None,
        strategy="Main",
        book="Main",
        desk="Equities",
        status="processed",
        version=1,
    )
]

market_inputs = {
    "AAPL": MarketInput(
        instrument_id="AAPL",
        market_price=212.5,
        fx_rate=1.0,
        risk_weight=0.25,
        market_data_timestamp=datetime(2026, 3, 21, 9, 31, tzinfo=UTC),
    )
}

analytics = compute_portfolio_analytics("PF-001", trades, market_inputs)
print(analytics.pnl.total_pnl)
print(analytics.risk.var_95)
```

A Jupyter example is available at `notebooks/helix_core_demo.ipynb`.
