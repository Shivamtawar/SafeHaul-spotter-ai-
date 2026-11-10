from datetime import UTC, datetime, timedelta, timezone

import pytest

from apps.trips.domain.errors import (
    ForecastOutOfRangeError,
    InvalidTripRequestError,
    NoRouteFoundError,
)
from apps.trips.domain.geometry import LatLon
from apps.trips.domain.risk import RiskLevel, WeatherSample
from apps.trips.domain.warnings import WarningSeverity
from apps.trips.services.plan_trip import PlanTripService
from apps.trips.services.types import TripRequest

from .fakes import CLEAR, FakeRouting, FakeWeather, route

NOW = datetime(2026, 11, 12, 7, 0, tzinfo=UTC)
DEPARTURE = datetime(2026, 11, 12, 8, 0, tzinfo=UTC)
DALLAS: LatLon = (32.7767, -96.797)
DENVER: LatLon = (39.7392, -104.9903)
SOUTH_MID: LatLon = (33.0, -101.0)
NORTH_MID: LatLon = (38.0, -100.0)
DIRECT_MID: LatLon = (36.0, -100.5)

SOUTH = route([DALLAS, SOUTH_MID, DENVER], miles=720, seconds=43_200)  # 12 h
DIRECT = route([DALLAS, DIRECT_MID, DENVER], miles=700, seconds=39_600)  # 11 h
NORTH = route([DALLAS, NORTH_MID, DENVER], miles=760, seconds=46_800)  # 13 h


def request(**overrides: object) -> TripRequest:
    values: dict[str, object] = {
        "origin": DALLAS,
        "destination": DENVER,
        "departure": DEPARTURE,
        "load_lbs": 20_000,
        "interval_miles": 25,
    }
    values.update(overrides)
    return TripRequest(**values)  # type: ignore[arg-type]


def service(routing: FakeRouting, weather: FakeWeather | None = None) -> PlanTripService:
    return PlanTripService(routing, weather or FakeWeather(), clock=lambda: NOW)


def storm_on_north_route(wind: float = 60) -> FakeWeather:
    """A storm over the middle of the north route that the direct and south routes miss."""

    def weather(position: LatLon, _when: datetime) -> WeatherSample:
        lat, lon = position
        in_storm = 37.0 < lat < 39.5 and -101.5 < lon < -98.0
        return WeatherSample(wind, 0, 0) if in_storm else CLEAR

    return FakeWeather(weather)


def test_returns_up_to_three_ranked_routes_with_the_safest_first() -> None:
    weather = storm_on_north_route(wind=50)  # severe wind only near the north route
    plan = service(FakeRouting([NORTH, DIRECT, SOUTH]), weather).plan(request())
    assert [r.route_id for r in plan.routes] == ["route-2", "route-3", "route-1"]
    assert [r.rank for r in plan.routes] == [1, 2, 3]
    assert plan.recommended.route_id == "route-2"
    assert plan.recommended_is_safe


def test_only_three_routes_are_considered() -> None:
    plan = service(FakeRouting([SOUTH, DIRECT, NORTH, SOUTH])).plan(request())
    assert len(plan.routes) == 3


def test_routing_receives_the_trip_and_load() -> None:
    routing = FakeRouting([DIRECT])
    service(routing).plan(request(load_lbs=55_000))
    assert routing.calls == [(DALLAS, DENVER, 55_000)]


def test_checkpoints_are_sampled_at_the_interval_including_both_ends() -> None:
    plan = service(FakeRouting([DIRECT])).plan(request(interval_miles=50))
    miles = [c.mile for c in plan.routes[0].assessment.checkpoints]
    assert miles == [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700]


def test_smaller_intervals_produce_more_checkpoints() -> None:
    counts = [
        len(
            service(FakeRouting([DIRECT]))
            .plan(request(interval_miles=i))
            .routes[0]
            .assessment.checkpoints
        )
        for i in (50, 25, 10)
    ]
    assert counts == sorted(counts)
    assert counts[0] < counts[1] < counts[2]


def test_weather_is_read_at_each_checkpoints_arrival_time() -> None:
    # Wind equals the hour of day, so the reading shows which hour was used.
    weather = FakeWeather(lambda _p, t: WeatherSample(wind_mph=t.hour, rain_in_hr=0, snow_in_hr=0))
    plan = service(FakeRouting([DIRECT]), weather).plan(request(interval_miles=350))
    start, middle, end = plan.routes[0].assessment.checkpoints
    assert start.eta == DEPARTURE
    assert middle.eta == DEPARTURE + timedelta(hours=5.5)
    assert end.eta == DEPARTURE + timedelta(hours=11)
    assert (start.weather.wind_mph, end.weather.wind_mph) == (8, 19)
    assert middle.weather.wind_mph in (13, 14)  # 13:30 sits between two hourly samples


def test_arrival_is_departure_plus_the_routes_duration() -> None:
    plan = service(FakeRouting([DIRECT])).plan(request())
    assert plan.routes[0].arrival == DEPARTURE + timedelta(hours=11)


def test_the_load_changes_the_risk() -> None:
    weather = FakeWeather(lambda _p, _t: WeatherSample(40, 0, 0))
    light = service(FakeRouting([DIRECT]), weather).plan(request(load_lbs=30_000))
    heavy = service(FakeRouting([DIRECT]), weather).plan(request(load_lbs=45_000))
    assert {c.level for c in light.routes[0].assessment.checkpoints} == {RiskLevel.HIGH}
    assert {c.level for c in heavy.routes[0].assessment.checkpoints} == {RiskLevel.SEVERE}


def test_no_travel_route_is_ranked_last_and_carries_a_critical_warning() -> None:
    plan = service(FakeRouting([NORTH, SOUTH]), storm_on_north_route()).plan(request())
    blocked = plan.routes[-1]
    assert blocked.route_id == "route-1"
    assert blocked.assessment.has_no_travel
    assert blocked.warnings[0].severity is WarningSeverity.CRITICAL
    assert "NO TRAVEL" in blocked.warnings[0].message
    assert plan.recommended.route_id == "route-2"
    assert plan.recommended_is_safe


def test_when_every_route_has_no_travel_the_best_is_flagged_unsafe() -> None:
    weather = FakeWeather(lambda _p, _t: WeatherSample(60, 0, 0))
    plan = service(FakeRouting([NORTH, SOUTH, DIRECT]), weather).plan(request())
    assert len(plan.routes) == 3
    assert not plan.recommended_is_safe
    assert all(r.assessment.has_no_travel for r in plan.routes)


def test_heatmap_has_a_risk_level_for_each_of_the_next_48_hours() -> None:
    plan = service(FakeRouting([DIRECT])).plan(request())
    assert plan.heatmap.start == DEPARTURE
    assert all(len(p.levels) == 49 for p in plan.heatmap.points)


def test_heatmap_reflects_how_the_weather_changes_over_time() -> None:
    weather = FakeWeather(
        lambda _p, t: WeatherSample(60 if t >= DEPARTURE + timedelta(hours=10) else 5, 0, 0)
    )
    plan = service(FakeRouting([DIRECT]), weather).plan(request())
    levels = plan.heatmap.points[0].levels
    assert levels[9] is RiskLevel.LOW
    assert levels[10] is RiskLevel.NO_TRAVEL
    assert levels[48] is RiskLevel.NO_TRAVEL


def test_heatmap_shares_one_point_where_routes_overlap() -> None:
    plan = service(FakeRouting([NORTH, SOUTH, DIRECT])).plan(request())
    origins = [p for p in plan.heatmap.points if p.position == pytest.approx(DALLAS, abs=0.01)]
    assert len(origins) == 1


def test_a_non_utc_departure_is_floored_to_the_utc_hour() -> None:
    india = timezone(timedelta(hours=5, minutes=30))
    weather = FakeWeather()
    departure = datetime(2026, 11, 12, 13, 30, tzinfo=india)  # 08:00 UTC
    plan = service(FakeRouting([DIRECT]), weather).plan(request(departure=departure))
    _, window_start, _ = weather.calls[0]
    assert window_start == DEPARTURE
    assert plan.heatmap.start == DEPARTURE


def test_weather_is_requested_once_for_all_checkpoints_in_route_order() -> None:
    weather = FakeWeather()
    plan = service(FakeRouting([SOUTH, DIRECT]), weather).plan(request())
    assert len(weather.calls) == 1
    points, _, _ = weather.calls[0]
    expected = sum(len(r.assessment.checkpoints) for r in plan.routes)
    assert len(points) == expected


def test_the_weather_window_covers_a_trip_longer_than_48_hours() -> None:
    slow = route([DALLAS, DENVER], miles=700, seconds=60 * 3600)
    weather = FakeWeather()
    plan = service(FakeRouting([slow]), weather).plan(request())
    _, _, window_end = weather.calls[0]
    assert window_end >= plan.routes[0].arrival
    last = plan.routes[0].assessment.checkpoints[-1]
    assert last.weather == CLEAR


def test_route_geometry_is_simplified_for_display() -> None:
    dense = route([(32.0 + i * 0.01, -96.0) for i in range(500)], miles=700, seconds=39_600)
    plan = service(FakeRouting([dense])).plan(request())
    assert len(plan.routes[0].geometry) < 10


@pytest.mark.parametrize(
    ("overrides", "message"),
    [
        ({"departure": NOW - timedelta(hours=7)}, "in the past"),
        ({"load_lbs": 0}, "load weight"),
        ({"interval_miles": 0}, "interval"),
        ({"destination": (32.7768, -96.7971)}, "too close"),
    ],
)
def test_invalid_requests_are_rejected_before_calling_providers(
    overrides: dict[str, object], message: str
) -> None:
    routing, weather = FakeRouting([DIRECT]), FakeWeather()
    with pytest.raises(InvalidTripRequestError, match=message):
        service(routing, weather).plan(request(**overrides))
    assert routing.calls == []
    assert weather.calls == []


def test_leaving_a_few_minutes_ago_is_allowed() -> None:
    plan = service(FakeRouting([DIRECT])).plan(request(departure=NOW - timedelta(hours=1)))
    assert plan.routes


def test_no_routes_is_reported() -> None:
    with pytest.raises(NoRouteFoundError):
        service(FakeRouting([])).plan(request())


def test_zero_length_routes_are_ignored() -> None:
    empty = route([DALLAS, DALLAS], miles=0, seconds=0)
    plan = service(FakeRouting([empty, DIRECT])).plan(request())
    assert len(plan.routes) == 1
    with pytest.raises(NoRouteFoundError):
        service(FakeRouting([empty])).plan(request())


def test_a_departure_beyond_the_forecast_is_rejected() -> None:
    with pytest.raises(ForecastOutOfRangeError, match="Choose an earlier departure"):
        service(FakeRouting([DIRECT])).plan(request(departure=NOW + timedelta(days=14)))


def test_a_departure_inside_the_forecast_is_accepted() -> None:
    plan = service(FakeRouting([DIRECT])).plan(request(departure=NOW + timedelta(days=12)))
    assert plan.routes


def test_routes_without_steps_fall_back_to_constant_speed() -> None:
    bare = route([DALLAS, DENVER], miles=700, seconds=39_600)
    bare = type(bare)(bare.geometry, bare.distance_miles, bare.duration_seconds, ())
    plan = service(FakeRouting([bare])).plan(request(interval_miles=350))
    assert plan.routes[0].assessment.checkpoints[1].eta == DEPARTURE + timedelta(hours=5.5)
