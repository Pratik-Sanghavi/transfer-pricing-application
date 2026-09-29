from math import floor


def percentile(values: list[float], fraction: float) -> float:
    if not values:
        raise ValueError("At least one comparable result is required")
    ordered = sorted(values)
    index = (len(ordered) - 1) * fraction
    lower, upper = floor(index), min(floor(index) + 1, len(ordered) - 1)
    return ordered[lower] + (ordered[upper] - ordered[lower]) * (index - lower)


def calculate_range(comparables: list[dict], tested_margin: float) -> dict:
    values = [float(item["margin"]) for item in comparables]
    q1, median, q3 = percentile(values, 0.25), percentile(values, 0.5), percentile(values, 0.75)
    adjustment = max(0.0, median - tested_margin) if tested_margin < q1 else min(0.0, median - tested_margin) if tested_margin > q3 else 0.0
    return {
        "comparable_count": len(values),
        "lower_quartile": q1,
        "median": median,
        "upper_quartile": q3,
        "tested_margin": tested_margin,
        "in_range": q1 <= tested_margin <= q3,
        "median_adjustment": adjustment,
    }