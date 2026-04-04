"""Registry for valuation model implementations."""

from __future__ import annotations

from .base import PnlModel

_MODEL_REGISTRY: dict[str, PnlModel] = {}


def get_pnl_model(name: str) -> PnlModel:
    try:
        return _MODEL_REGISTRY[name]
    except KeyError as exc:
        supported = ", ".join(sorted(_MODEL_REGISTRY))
        raise ValueError(f"Unsupported pnl model '{name}'. Supported models: {supported}.") from exc


def resolve_pnl_model(model: str | PnlModel | None) -> PnlModel:
    if model is None:
        return get_pnl_model("average_cost")
    if isinstance(model, str):
        return get_pnl_model(model)
    return model


def register_pnl_model(model: PnlModel) -> PnlModel:
    _MODEL_REGISTRY[model.name] = model
    return model
