"""Registry for risk model implementations."""

from __future__ import annotations

from .base import RiskModel

_MODEL_REGISTRY: dict[str, RiskModel] = {}


def get_risk_model(name: str) -> RiskModel:
    try:
        return _MODEL_REGISTRY[name]
    except KeyError as exc:
        supported = ", ".join(sorted(_MODEL_REGISTRY))
        raise ValueError(f"Unsupported risk model '{name}'. Supported models: {supported}.") from exc


def resolve_risk_model(model: str | RiskModel | None) -> RiskModel:
    if model is None:
        return get_risk_model("standard")
    if isinstance(model, str):
        return get_risk_model(model)
    return model


def register_risk_model(model: RiskModel) -> RiskModel:
    _MODEL_REGISTRY[model.name] = model
    return model
