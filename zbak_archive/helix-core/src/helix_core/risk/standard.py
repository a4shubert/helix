"""Standard portfolio risk model."""

from __future__ import annotations

from math import sqrt

from helix_core.market import MarketInput
from helix_core.positions import PositionSnapshot
from helix_core.risk.schema import PortfolioRiskSnapshot
from helix_core.utilities import round2, utc_now

from .registry import register_risk_model


class StandardRiskModel:
    """Compute delta, gross/net exposure, and proxy var_95."""

    name = "standard"

    def compute(
        self,
        portfolio_id: str,
        positions: list[PositionSnapshot],
        market_inputs: dict[str, MarketInput],
        *,
        valuation_ts=None,
    ) -> PortfolioRiskSnapshot:
        valuation_time = valuation_ts or utc_now()
        delta = 0.0
        gross_exposure = 0.0
        net_exposure = 0.0
        variance = 0.0

        for position in positions:
            signed_market_value = position.market_value if position.direction == "LONG" else -position.market_value
            delta += signed_market_value
            net_exposure += signed_market_value
            gross_exposure += abs(signed_market_value)
            market = market_inputs[position.instrument_id]
            variance += (signed_market_value * market.volatility) ** 2

        return PortfolioRiskSnapshot(
            portfolio_id=portfolio_id,
            delta=round2(delta),
            gross_exposure=round2(gross_exposure),
            net_exposure=round2(net_exposure),
            var_95=round2(1.65 * sqrt(variance)),
            valuation_ts=valuation_time,
        )


register_risk_model(StandardRiskModel())
