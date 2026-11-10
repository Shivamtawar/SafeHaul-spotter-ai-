from datetime import UTC, datetime

import pytest

from apps.trips.domain.models import CheckpointInput, RouteAssessment
from apps.trips.domain.ranking import assess_route, rank_routes, recommend, segment_miles
from apps.trips.domain.risk import RiskLevel, WeatherSample

ETA = datetime(2026, 11, 12, 8, 0, tzinfo=UTC)
LIGHT_LOAD = 10_000

# Wind speeds that land on each level for a light load.
WIND = {
    RiskLevel.LOW: 5,
    RiskLevel.MODERATE: 30,
    RiskLevel.HIGH: 40,
    RiskLevel.SEVERE: 50,
    RiskLevel.NO_TRAVEL: 60,
}


def build(
    route_id: str,
    levels: list[RiskLevel],
    *,
    distance: float | None = None,
    duration: float = 36_000,
    load: float = LIGHT_LOAD,
) -> RouteAssessment:
    """A route with one checkpoint per level, evenly spaced over ``distance`` miles."""
    distance = distance if distance is not None else 100.0 * (len(levels) - 1)
    step = distance / (len(levels) - 1) if len(levels) > 1 else 0
    inputs = [
        CheckpointInput(
            mile=i * step,
            position=(0.0, 0.0),
            eta=ETA,
            weather=WeatherSample(WIND[level], 0, 0),
        )
        for i, level in enumerate(levels)
    ]
    return assess_route(route_id, distance, duration, inputs, load)


LOW, MOD, HIGH, SEV, NT = (
    RiskLevel.LOW,
    RiskLevel.MODERATE,
    RiskLevel.HIGH,
    RiskLevel.SEVERE,
    RiskLevel.NO_TRAVEL,
)


def test_segment_miles_splits_the_road_at_midpoints() -> None:
    assert segment_miles([0, 25, 50], 50) == [12.5, 25, 12.5]


def test_segment_miles_sums_to_the_total_distance() -> None:
    miles = [0, 25, 50, 75, 90]
    assert sum(segment_miles(miles, 90)) == pytest.approx(90)


def test_segment_miles_for_a_single_checkpoint() -> None:
    assert segment_miles([0], 0) == [0]
    assert segment_miles([], 10) == []


def test_assessment_sums_miles_per_level() -> None:
    route = build("a", [LOW, SEV, SEV, LOW], distance=300)
    assert route.severe_miles == pytest.approx(200)
    assert route.high_miles == 0
    assert route.miles_by_level[LOW] == pytest.approx(100)
    assert sum(route.miles_by_level.values()) == pytest.approx(300)


def test_average_risk_is_mile_weighted() -> None:
    route = build("a", [LOW, HIGH, LOW], distance=200)
    # HIGH stands for 100 of 200 miles at score 2 => 1.0
    assert route.avg_risk == pytest.approx(1.0)


def test_checkpoints_carry_level_reasons_and_stretch() -> None:
    route = build("a", [LOW, SEV], distance=100)
    assert [c.level for c in route.checkpoints] == [LOW, SEV]
    assert route.checkpoints[1].reasons == ("Wind 50 mph: Severe",)
    assert route.checkpoints[0].segment_miles == pytest.approx(50)


def test_load_changes_the_assessment() -> None:
    inputs = [CheckpointInput(0, (0, 0), ETA, WeatherSample(40, 0, 0))]
    light = assess_route("a", 0, 0, inputs, 20_000)
    heavy = assess_route("a", 0, 0, inputs, 45_000)
    assert light.checkpoints[0].level is HIGH
    assert heavy.checkpoints[0].level is SEV


def test_zero_distance_route_does_not_divide_by_zero() -> None:
    route = build("a", [LOW], distance=0)
    assert route.avg_risk == 0


def test_empty_checkpoints_are_rejected() -> None:
    with pytest.raises(ValueError, match="at least one checkpoint"):
        assess_route("a", 10, 10, [], LIGHT_LOAD)


def test_fewest_severe_miles_wins_over_everything_else() -> None:
    fewer_severe = build("fewer_severe", [LOW, SEV, LOW, LOW, LOW], duration=90_000)
    shorter = build("shorter", [LOW, SEV, SEV, LOW, LOW], duration=10_000)
    assert recommend([shorter, fewer_severe]).route_id == "fewer_severe"


def test_severe_miles_beat_high_miles() -> None:
    high_heavy = build("high_heavy", [HIGH, HIGH, HIGH, HIGH])
    one_severe = build("one_severe", [LOW, LOW, SEV, LOW])
    assert recommend([one_severe, high_heavy]).route_id == "high_heavy"


def test_fewest_high_miles_breaks_a_severe_tie() -> None:
    a = build("a", [LOW, HIGH, HIGH, LOW])
    b = build("b", [LOW, HIGH, LOW, LOW])
    assert recommend([a, b]).route_id == "b"


def test_lowest_average_risk_breaks_a_severe_and_high_tie() -> None:
    a = build("a", [MOD, MOD, MOD, MOD])
    b = build("b", [LOW, LOW, MOD, LOW])
    assert recommend([a, b]).route_id == "b"


def test_shortest_time_is_the_last_tiebreaker() -> None:
    slow = build("slow", [LOW, LOW, LOW], duration=40_000)
    fast = build("fast", [LOW, LOW, LOW], duration=30_000)
    assert recommend([slow, fast]).route_id == "fast"


def test_full_ties_keep_the_provider_order() -> None:
    first = build("first", [LOW, LOW])
    second = build("second", [LOW, LOW])
    assert [r.route_id for r in rank_routes([first, second])] == ["first", "second"]


def test_mile_differences_below_a_tenth_are_ignored() -> None:
    a = build("a", [LOW, SEV, LOW], distance=200.00, duration=20_000)
    b = build("b", [LOW, SEV, LOW], distance=200.04, duration=10_000)
    assert recommend([a, b]).route_id == "b"


def test_no_travel_route_is_ranked_last_even_with_fewer_severe_miles() -> None:
    blocked = build("blocked", [LOW, NT, LOW, LOW, LOW, LOW])
    severe = build("severe", [SEV, SEV, SEV, SEV, SEV, SEV])
    ranked = rank_routes([blocked, severe])
    assert [r.route_id for r in ranked] == ["severe", "blocked"]
    assert blocked.has_no_travel
    assert not severe.has_no_travel


def test_no_travel_route_is_recommended_only_when_every_route_has_one() -> None:
    a = build("a", [LOW, NT, NT, LOW])
    b = build("b", [LOW, NT, LOW, LOW])
    c = build("c", [LOW, NT, LOW, LOW], duration=1_000)
    ranked = rank_routes([a, b, c])
    assert [r.route_id for r in ranked] == ["c", "b", "a"]
    assert recommend([a, b, c]).route_id == "c"


def test_recommend_requires_routes() -> None:
    with pytest.raises(ValueError, match="no routes"):
        recommend([])
