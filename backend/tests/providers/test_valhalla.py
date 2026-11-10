import json

import pytest
import responses
from django.core.cache.backends.base import BaseCache
from tenacity import wait_none

from apps.trips.domain.errors import NoRouteFoundError, UpstreamUnavailableError
from apps.trips.providers.http import HttpClient
from apps.trips.providers.valhalla import ValhallaRouting

from .helpers import encode_polyline

BASE = "https://valhalla.test"
ORIGIN = (32.7767, -96.797)
DESTINATION = (39.7392, -104.9903)


def trip(miles: float, seconds: float) -> dict[str, object]:
    return {
        "summary": {"length": miles, "time": seconds},
        "legs": [
            {
                "shape": encode_polyline([ORIGIN, (36.0, -100.0), DESTINATION]),
                "maneuvers": [
                    {"length": miles / 2, "time": seconds / 2},
                    {"length": miles / 2, "time": seconds / 2},
                ],
            }
        ],
    }


@pytest.fixture
def routing(cache: BaseCache) -> ValhallaRouting:
    http = HttpClient("Alternates", timeout=1, user_agent="t", wait=wait_none())
    return ValhallaRouting(http, BASE, cache, ttl=60)


@responses.activate
def test_returns_the_best_route_and_its_alternates(routing: ValhallaRouting) -> None:
    responses.post(
        f"{BASE}/route",
        json={
            "trip": trip(800, 40_000),
            "alternates": [{"trip": trip(850, 41_000)}, {"trip": trip(900, 43_000)}],
        },
    )
    options = routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    assert [round(o.distance_miles) for o in options] == [800, 850, 900]
    first = options[0]
    assert first.duration_seconds == 40_000
    assert first.steps == ((400, 20_000), (400, 20_000))
    assert first.geometry[0] == pytest.approx(ORIGIN)
    assert first.geometry[-1] == pytest.approx(DESTINATION)


@responses.activate
def test_asks_for_truck_routes_with_the_load_weight_in_tonnes(routing: ValhallaRouting) -> None:
    responses.post(f"{BASE}/route", json={"trip": trip(800, 40_000)})
    routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    payload = json.loads(responses.calls[0].request.body)
    assert payload["costing"] == "truck"
    assert payload["alternates"] == 2
    assert payload["units"] == "miles"
    assert payload["costing_options"]["truck"]["weight"] == 27  # 60,000 lb is about 27.2 t
    assert payload["locations"] == [
        {"lat": ORIGIN[0], "lon": ORIGIN[1]},
        {"lat": DESTINATION[0], "lon": DESTINATION[1]},
    ]


@responses.activate
def test_a_very_light_load_is_sent_as_at_least_one_tonne(routing: ValhallaRouting) -> None:
    responses.post(f"{BASE}/route", json={"trip": trip(800, 40_000)})
    routing.routes(ORIGIN, DESTINATION, load_lbs=100)
    assert json.loads(responses.calls[0].request.body)["costing_options"]["truck"]["weight"] == 1


@responses.activate
def test_identical_requests_are_served_from_cache(routing: ValhallaRouting) -> None:
    responses.post(f"{BASE}/route", json={"trip": trip(800, 40_000)})
    routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    assert len(responses.calls) == 1


@responses.activate
def test_no_path_is_reported_as_no_route_and_not_cached(routing: ValhallaRouting) -> None:
    responses.post(f"{BASE}/route", status=400, json={"error_code": 442})
    for _ in range(2):
        with pytest.raises(NoRouteFoundError):
            routing.routes(ORIGIN, DESTINATION, load_lbs=1_000)
    assert len(responses.calls) == 2


@responses.activate
def test_unexpected_status_is_an_upstream_failure(routing: ValhallaRouting) -> None:
    responses.post(f"{BASE}/route", status=404, json={})
    with pytest.raises(UpstreamUnavailableError):
        routing.routes(ORIGIN, DESTINATION, load_lbs=1_000)


@responses.activate
@pytest.mark.parametrize("body", [{"unexpected": True}, ["not", "an", "object"]])
def test_malformed_body_is_an_upstream_failure(routing: ValhallaRouting, body: object) -> None:
    responses.post(f"{BASE}/route", json=body)
    with pytest.raises(UpstreamUnavailableError, match="unexpected response"):
        routing.routes(ORIGIN, DESTINATION, load_lbs=1_000)
