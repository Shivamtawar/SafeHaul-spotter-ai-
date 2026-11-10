"""Turn sampled checkpoints into a route assessment, and rank routes against each other.

Ranking order (ADR 0002): routes with No Travel weather come last; then fewest Severe miles,
fewest High miles, lowest average risk, shortest travel time.
"""

from collections.abc import Sequence
from itertools import pairwise

from .models import Checkpoint, CheckpointInput, RouteAssessment
from .risk import RiskLevel, assess

MILES_PRECISION = 1  # compare miles to 0.1 so float noise cannot decide a ranking
RISK_PRECISION = 3


def segment_miles(miles: Sequence[float], total_miles: float) -> list[float]:
    """Road each checkpoint stands for: from the midpoint before it to the midpoint after it."""
    if not miles:
        return []
    boundaries = [0.0]
    boundaries += [(a + b) / 2 for a, b in pairwise(miles)]
    boundaries.append(total_miles)
    return [max(end - start, 0.0) for start, end in pairwise(boundaries)]


def assess_route(
    route_id: str,
    distance_miles: float,
    duration_seconds: float,
    inputs: Sequence[CheckpointInput],
    load_lbs: float,
) -> RouteAssessment:
    if not inputs:
        raise ValueError("a route needs at least one checkpoint")
    stretches = segment_miles([i.mile for i in inputs], distance_miles)
    checkpoints: list[Checkpoint] = []
    miles_by_level: dict[RiskLevel, float] = {}
    for item, stretch in zip(inputs, stretches, strict=True):
        risk = assess(item.weather, load_lbs)
        checkpoints.append(
            Checkpoint(
                mile=item.mile,
                position=item.position,
                eta=item.eta,
                weather=item.weather,
                level=risk.level,
                reasons=risk.reasons,
                segment_miles=stretch,
            )
        )
        miles_by_level[risk.level] = miles_by_level.get(risk.level, 0.0) + stretch
    covered = sum(miles_by_level.values())
    weighted = sum(level * miles for level, miles in miles_by_level.items())
    avg_risk = weighted / covered if covered > 0 else 0.0
    return RouteAssessment(
        route_id=route_id,
        distance_miles=distance_miles,
        duration_seconds=duration_seconds,
        checkpoints=tuple(checkpoints),
        miles_by_level=miles_by_level,
        avg_risk=avg_risk,
    )


def sort_key(route: RouteAssessment) -> tuple[bool, float, float, float, float, int]:
    return (
        route.has_no_travel,
        round(route.no_travel_miles, MILES_PRECISION),
        round(route.severe_miles, MILES_PRECISION),
        round(route.high_miles, MILES_PRECISION),
        round(route.avg_risk, RISK_PRECISION),
        round(route.duration_seconds),
    )


def rank_routes(routes: Sequence[RouteAssessment]) -> list[RouteAssessment]:
    """Best first. Ties keep the input order (the provider's own preference)."""
    return sorted(routes, key=sort_key)


def recommend(routes: Sequence[RouteAssessment]) -> RouteAssessment:
    if not routes:
        raise ValueError("no routes to choose from")
    return rank_routes(routes)[0]
