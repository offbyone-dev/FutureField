"""Shared math used by suitability AND rotation (one scoring core)."""
from app.schemas.analysis import Priorities


def clamp01(x: float) -> float:
    return max(0.0, min(1.0, x))


def trapezoid(x: float, a: float, b: float, c: float, d: float) -> float:
    """0 outside (a,d), 1 on [b,c], linear ramps between. Use b==c for a triangle."""
    if x <= a or x >= d:
        return 0.0
    if b <= x <= c:
        return 1.0
    if x < b:
        return (x - a) / (b - a) if b != a else 1.0
    return (d - x) / (d - c) if d != c else 1.0


def normalize_weights(w: dict[str, float]) -> dict[str, float]:
    total = sum(w.values())
    if total <= 0:
        return {k: 1 / len(w) for k in w}
    return {k: v / total for k, v in w.items()}


def weighted_sum(components: dict[str, float], weights: dict[str, float]) -> float:
    """sum_i w_i * s_i  (weights must already sum to 1) -> 0..1"""
    return sum(weights[k] * components.get(k, 0.0) for k in weights)


def priorities_to_weights(p: Priorities) -> dict[str, float]:
    """Suitability weights. w_i = base_i * (0.5 + priority_i), then normalized to sum 1.
    TODO(inside): agree this mapping  (e.g. should yield priority
    also boost a separate 'yield' component using crop.yield_index?)."""
    raw = {
        "water": 0.5 + p.water,
        "temp": 0.5 + p.yield_potential,
        "soil": 0.5 + p.soil_health,
        "risk": 0.5 + p.risk,
    }
    return normalize_weights(raw)


def rotation_weights(p: Priorities) -> dict[str, float]:
    """Weights for the rotation total. Suitability always counts double."""
    raw = {
        "suitability": 2.0,
        "water_impact": 0.5 + p.water,
        "soil_impact": 0.5 + p.soil_health,
        "resilience": 0.5 + p.risk,
        "yield": 0.5 + p.yield_potential,
    }
    return normalize_weights(raw)
