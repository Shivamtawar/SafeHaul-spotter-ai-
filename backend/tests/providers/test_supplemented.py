import logging
from collections.abc import Sequence

import pytest

from apps.trips.domain.errors import (
    NoRouteFoundError,
    RateLimitedError,
    UpstreamUnavailableError,
)
from apps.trips.domain.geometry import LatLon
from apps.trips.providers.ports import RouteOption
from apps.trips.providers.supplemented import SupplementedRouting
from tests.services.fakes import FakeRouting, route

ORIGIN: LatLon = (0.0, 0.0)
DESTINATION: LatLon = (0.0, 3.0)  # roughly 207 miles east


def corridor(latitude: float, miles: float = 207) -> RouteOption:
    """A straight route along ``latitude``; corridors 1 degree apart are ~69 miles apart."""
    return route([(latitude, 0.0), (latitude, 3.0)], miles=miles, seconds=miles * 60)


MAIN = corridor(0.0)
SAME_ROAD = corridor(0.005)  # about a third of a mile off MAIN: the same road
NORTH = corridor(1.0, miles=215)
SOUTH = corridor(-1.0, miles=220)


class FailingRouting:
    def __init__(self, error: Exception) -> None:
        self.error = error
        self.calls = 0

    def routes(self, origin: LatLon, destination: LatLon, *, load_lbs: float) -> list[RouteOption]:
        self.calls += 1
        raise self.error


def ids(routes: Sequence[RouteOption]) -> list[int]:
    return [round(r.distance_miles) for r in routes]


def routing(primary: object, supplement: object) -> SupplementedRouting:
    return SupplementedRouting(primary, supplement)  # type: ignore[arg-type]


def test_three_primary_routes_need_no_supplement() -> None:
    supplement = FakeRouting([NORTH])
    result = routing(FakeRouting([MAIN, NORTH, SOUTH]), supplement).routes(
        ORIGIN, DESTINATION, load_lbs=1
    )
    assert len(result) == 3
    assert supplement.calls == []


def test_a_single_primary_route_is_topped_up_with_distinct_alternates() -> None:
    result = routing(FakeRouting([MAIN]), FakeRouting([SAME_ROAD, NORTH, SOUTH])).routes(
        ORIGIN, DESTINATION, load_lbs=1
    )
    assert ids(result) == [207, 215, 220]  # the duplicate of MAIN was dropped


def test_the_primary_route_always_comes_first() -> None:
    result = routing(FakeRouting([MAIN]), FakeRouting([NORTH, SOUTH])).routes(
        ORIGIN, DESTINATION, load_lbs=1
    )
    assert result[0] is MAIN


def test_candidates_that_repeat_each_other_are_not_added_twice() -> None:
    twin_of_north = corridor(1.002, miles=216)
    result = routing(FakeRouting([MAIN]), FakeRouting([NORTH, twin_of_north, SOUTH])).routes(
        ORIGIN, DESTINATION, load_lbs=1
    )
    assert ids(result) == [207, 215, 220]


def test_stops_at_three_routes() -> None:
    extra = corridor(2.0, miles=230)
    result = routing(FakeRouting([MAIN]), FakeRouting([NORTH, SOUTH, extra])).routes(
        ORIGIN, DESTINATION, load_lbs=1
    )
    assert len(result) == 3


def test_fewer_than_three_when_the_supplement_has_nothing_new() -> None:
    result = routing(FakeRouting([MAIN]), FakeRouting([SAME_ROAD])).routes(
        ORIGIN, DESTINATION, load_lbs=1
    )
    assert result == [MAIN]


@pytest.mark.parametrize(
    "error", [NoRouteFoundError("x"), UpstreamUnavailableError("x"), RateLimitedError("x")]
)
def test_primary_routes_survive_a_supplement_failure(
    error: Exception, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING):
        result = routing(FakeRouting([MAIN]), FailingRouting(error)).routes(
            ORIGIN, DESTINATION, load_lbs=1
        )
    assert result == [MAIN]
    assert "supplementary_routing_unavailable" in caplog.text


@pytest.mark.parametrize("error", [UpstreamUnavailableError("x"), RateLimitedError("x")])
def test_the_supplement_serves_the_request_when_the_primary_is_down(
    error: Exception, caplog: pytest.LogCaptureFixture
) -> None:
    with caplog.at_level(logging.WARNING):
        result = routing(FailingRouting(error), FakeRouting([MAIN, NORTH, SOUTH, NORTH])).routes(
            ORIGIN, DESTINATION, load_lbs=1
        )
    assert len(result) == 3
    assert "primary_routing_unavailable" in caplog.text


def test_no_route_from_the_primary_is_final() -> None:
    supplement = FakeRouting([MAIN])
    with pytest.raises(NoRouteFoundError):
        routing(FailingRouting(NoRouteFoundError("none")), supplement).routes(
            ORIGIN, DESTINATION, load_lbs=1
        )
    assert supplement.calls == []


def test_the_load_is_passed_to_both_providers() -> None:
    primary, supplement = FakeRouting([MAIN]), FakeRouting([NORTH])
    routing(primary, supplement).routes(ORIGIN, DESTINATION, load_lbs=55_000)
    assert primary.calls[0][2] == 55_000
    assert supplement.calls[0][2] == 55_000
