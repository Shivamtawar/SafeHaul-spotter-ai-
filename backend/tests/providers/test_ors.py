import json
from typing import Any

import pytest
import responses
from django.core.cache.backends.base import BaseCache
from tenacity import wait_none

from apps.trips.domain.errors import NoRouteFoundError, UpstreamUnavailableError
from apps.trips.providers.http import HttpClient
from apps.trips.providers.ors import OrsGeocoder, OrsRouting

BASE = "https://ors.test"
DIRECTIONS = f"{BASE}/v2/directions/driving-hgv/geojson"
GEOCODE = f"{BASE}/geocode/autocomplete"
ORIGIN = (32.7767, -96.797)
DESTINATION = (39.7392, -104.9903)


def feature(miles: float, seconds: float) -> dict[str, Any]:
    return {
        "type": "Feature",
        "geometry": {
            "type": "LineString",
            "coordinates": [[-96.797, 32.7767], [-100.0, 36.0], [-104.9903, 39.7392]],
        },
        "properties": {
            "summary": {"distance": miles, "duration": seconds},
            "segments": [
                {"steps": [{"distance": miles / 2, "duration": seconds / 2}]},
                {"steps": [{"distance": miles / 2, "duration": seconds / 2}]},
            ],
        },
    }


def collection(*features: dict[str, Any]) -> dict[str, Any]:
    return {"type": "FeatureCollection", "features": list(features)}


@pytest.fixture
def http() -> HttpClient:
    return HttpClient("ORS", timeout=1, user_agent="t", wait=wait_none())


@pytest.fixture
def routing(http: HttpClient, cache: BaseCache) -> OrsRouting:
    return OrsRouting(http, BASE, cache, ttl=60)


@responses.activate
def test_returns_every_route_ors_offers(routing: OrsRouting) -> None:
    responses.post(
        DIRECTIONS,
        json=collection(feature(800, 40_000), feature(850, 41_000), feature(900, 43_000)),
    )
    options = routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    assert [round(o.distance_miles) for o in options] == [800, 850, 900]
    first = options[0]
    assert first.duration_seconds == 40_000
    assert first.steps == ((400, 20_000), (400, 20_000))
    # GeoJSON is [lon, lat]; the domain uses (lat, lon).
    assert first.geometry == ((32.7767, -96.797), (36.0, -100.0), (39.7392, -104.9903))


@responses.activate
def test_asks_for_three_truck_alternatives_in_miles_with_the_load_weight(
    routing: OrsRouting,
) -> None:
    responses.post(DIRECTIONS, json=collection(feature(800, 40_000)))
    routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    payload = json.loads(responses.calls[0].request.body)
    assert payload["coordinates"] == [[-96.797, 32.7767], [-104.9903, 39.7392]]  # lon, lat
    assert payload["units"] == "mi"
    assert payload["alternative_routes"]["target_count"] == 3
    assert payload["options"]["profile_params"]["restrictions"]["weight"] == 27  # ~27.2 t


@responses.activate
def test_retries_without_alternatives_when_ors_refuses_them(routing: OrsRouting) -> None:
    responses.post(
        DIRECTIONS,
        status=400,
        json={"error": {"code": 2004, "message": "alternative_routes not allowed at this length"}},
    )
    responses.post(DIRECTIONS, json=collection(feature(800, 40_000)))
    options = routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)
    assert len(options) == 1
    first, second = (json.loads(c.request.body) for c in responses.calls)
    assert "alternative_routes" in first
    assert "alternative_routes" not in second


@responses.activate
def test_no_route_when_even_a_single_route_is_refused(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, status=400, json={"error": {"message": "nope"}})
    with pytest.raises(NoRouteFoundError):
        routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)
    assert len(responses.calls) == 2


@responses.activate
def test_ors_not_found_means_no_route(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, status=404, json={"error": {"code": 2009}})
    with pytest.raises(NoRouteFoundError):
        routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)
    assert len(responses.calls) == 1


@responses.activate
@pytest.mark.parametrize("status", [401, 403])
def test_a_rejected_key_is_an_upstream_failure(routing: OrsRouting, status: int) -> None:
    responses.post(
        DIRECTIONS, status=status, json={"error": "Access to this API has been disallowed"}
    )
    with pytest.raises(UpstreamUnavailableError, match="API key"):
        routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)


@responses.activate
def test_other_statuses_are_upstream_failures(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, status=409, json={})
    with pytest.raises(UpstreamUnavailableError):
        routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)


@responses.activate
def test_malformed_body_is_an_upstream_failure(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, json={"unexpected": True})
    with pytest.raises(UpstreamUnavailableError, match="unexpected response"):
        routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)


@responses.activate
def test_identical_requests_are_served_from_cache(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, json=collection(feature(800, 40_000)))
    routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    routing.routes(ORIGIN, DESTINATION, load_lbs=60_000)
    assert len(responses.calls) == 1


@responses.activate
def test_a_different_load_weight_is_a_different_request(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, json=collection(feature(800, 40_000)))
    routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)
    routing.routes(ORIGIN, DESTINATION, load_lbs=70_000)
    assert len(responses.calls) == 2


@responses.activate
def test_failures_are_not_cached(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, status=404, json={})
    for _ in range(2):
        with pytest.raises(NoRouteFoundError):
            routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)
    assert len(responses.calls) == 2


@pytest.fixture
def geocoder(http: HttpClient, cache: BaseCache) -> OrsGeocoder:
    return OrsGeocoder(http, BASE, cache, ttl=60)


def place(label: str, lon: float, lat: float) -> dict[str, Any]:
    return {"geometry": {"coordinates": [lon, lat]}, "properties": {"label": label}}


@responses.activate
def test_search_maps_features_to_places(geocoder: OrsGeocoder) -> None:
    responses.get(
        GEOCODE,
        json=collection(
            place("Dallas, TX, USA", -96.797, 32.776), place("Dallas, GA, USA", -84.8, 33.9)
        ),
    )
    places = geocoder.search("Dallas", limit=2)
    assert [p.label for p in places] == ["Dallas, TX, USA", "Dallas, GA, USA"]
    assert places[0].position == (32.776, -96.797)  # (lat, lon): ORS returns [lon, lat]
    assert "text=Dallas" in responses.calls[0].request.url
    assert "size=2" in responses.calls[0].request.url


@responses.activate
def test_features_without_coordinates_or_label_are_skipped(geocoder: OrsGeocoder) -> None:
    responses.get(
        GEOCODE,
        json=collection(
            {"geometry": {}, "properties": {"label": "Nowhere"}},
            {"geometry": {"coordinates": [1, 2]}, "properties": {}},
            place("Keep", 1, 2),
        ),
    )
    assert [p.label for p in geocoder.search("xyz")] == ["Keep"]


@responses.activate
def test_repeat_searches_are_cached_ignoring_case_and_spacing(geocoder: OrsGeocoder) -> None:
    responses.get(GEOCODE, json=collection(place("Dallas", 1, 2)))
    geocoder.search("Dallas")
    geocoder.search("  dallas ")
    assert len(responses.calls) == 1


@responses.activate
@pytest.mark.parametrize("status", [401, 403])
def test_geocoder_reports_a_rejected_key(geocoder: OrsGeocoder, status: int) -> None:
    responses.get(GEOCODE, status=status, json={})
    with pytest.raises(UpstreamUnavailableError, match="API key"):
        geocoder.search("Dallas")


@responses.activate
def test_geocoder_reports_other_bad_statuses(geocoder: OrsGeocoder) -> None:
    responses.get(GEOCODE, status=400, json={})
    with pytest.raises(UpstreamUnavailableError):
        geocoder.search("Dallas")


@responses.activate
def test_geocoder_reports_a_malformed_body(geocoder: OrsGeocoder) -> None:
    responses.get(GEOCODE, json={"nope": []})
    with pytest.raises(UpstreamUnavailableError, match="unexpected response"):
        geocoder.search("Dallas")


@responses.activate
def test_an_unreadable_alternatives_error_still_falls_back(routing: OrsRouting) -> None:
    responses.post(DIRECTIONS, status=400, json=["not", "an", "object"])
    responses.post(DIRECTIONS, json=collection(feature(800, 40_000)))
    assert len(routing.routes(ORIGIN, DESTINATION, load_lbs=20_000)) == 1
