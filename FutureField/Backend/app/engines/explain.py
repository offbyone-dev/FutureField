"""Human-readable reasons built from score components (never free-form text)."""
from app.schemas.analysis import ExplanationItem

LABELS: dict[str, tuple[str, str]] = {
    "water": ("Water supply matches the crop's need", "Water supply is short or excessive for this crop"),
    "temp": ("Temperature is in the crop's comfort range", "Temperature is outside the crop's best range"),
    "soil": ("Soil pH and texture suit the crop", "Soil pH or texture is a poor match"),
    "risk": ("Low drought/heat/flood risk for this crop", "Field risks hit this crop's weak points"),
    "suitability": ("Each crop fits the field well", "Some crops in the sequence fit the field poorly"),
    "water_impact": ("Total water load of the sequence is manageable", "Sequence demands more water than available"),
    "soil_impact": ("Sequence maintains or improves soil", "Sequence drains soil fertility"),
    "resilience": ("Diverse, climate-resilient sequence", "Sequence is repetitive or drought-sensitive"),
    "yield": ("Strong yield potential", "Limited yield potential"),
}


def explain_terms(terms: dict[str, float], weights: dict[str, float], top_k: int = 2) -> list[ExplanationItem]:
    """impact_i = w_i * (s_i - 0.5): positive if the term helps, negative if it hurts.
    Returns top_k positives and top_k negatives. TODO(inside): add numbers to the text
    (e.g. 'Rainfall 520 mm vs need 600 mm') by passing raw values in."""
    impacts = sorted(((k, weights[k] * (terms[k] - 0.5)) for k in weights), key=lambda kv: kv[1])
    items = []
    for k, imp in reversed(impacts[-top_k:]):
        if imp > 0:
            items.append(ExplanationItem(component=k, impact=round(imp, 4), direction="positive", text=LABELS[k][0]))
    for k, imp in impacts[:top_k]:
        if imp < 0:
            items.append(ExplanationItem(component=k, impact=round(imp, 4), direction="negative", text=LABELS[k][1]))
    return items
