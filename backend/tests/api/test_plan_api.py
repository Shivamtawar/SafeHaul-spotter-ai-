from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from rest_framework.test import APIClient

from apps.trips.api import dependencies
from apps.trips.domain.errors import (
    DomainError,
    ForecastOutOfRangeError,
    InvalidTripRequestError,
    NoRouteFoundError,
    RateLimitedError,
    UpstreamUnavailableError,
)
from apps.trips.domain.risk import WeatherSample
from apps.trips.services.plan_trip import PlanTripService
from tests.services.fakes import FakeRouting, FakeWeather, route

NOW = datetime(2026, 11, 12, 7, 0, tzinfo=UTC)
DALLAS = (32.7767, -96.797)
DENVER = (39.7392, -104.9903)
DIRECT = route([DALLAS, (36.0, -100.5), DENVER], miles=700, seconds=39_600)
SOUTH = route([DALLAS, (33.0, -101.0), DENVER], miles=720, seconds=43_200)

BODY: dict[str, Any] = {
    "origin": {"lat": DALLAS[0], "lon": DALLAS[1], "name": "Dallas, Texas"},
    "destination": {"lat": DENVER[0], "lon": DENVER[1]},
    "departure": "2026-11-12T08:00:00Z",
    "load_lbs": 45_000,
    "interval_miles": 50,
}


@pytest.fixture
def client() -> APIClient:
    return APIClient()


@pytest.fixture
def use_fakes(monkeypatch: pytest.MonkeyPatch) -> None:
    service = PlanTripService(FakeRouting([DIRECT, SOUTH]), FakeWeather(), clock=lambda: NOW)
    monkeypatch.setattr(dependencies, "get_plan_service", lambda: service)


class RaisingService:
    def __init__(self, error: DomainError) -> None:
        self.error = error

    def plan(self, _request: object) -> object:
        raise self.error


def test_plan_returns_ranked_routes_with_checkpoints_and_heatmap(
    client: APIClient, use_fakes: None
) -> None:
    response = client.post("/api/v1/plan", BODY, format="json")
    assert response.status_code == 200
    body = response.json()
    assert body["recommended_route_id"] == "route-1"
    assert body["recommended_is_safe"] is True
    assert body["load_lbs"] == 45_000
    assert body["interval_miles"] == 50
    assert [r["rank"] for r in body["routes"]] == [1, 2]
    assert [r["recommended"] for r in body["routes"]] == [True, False]

    first = body["routes"][0]
    assert first["distance_miles"] == 700
    assert first["duration_seconds"] == 39_600
    assert first["arrival"] == "2026-11-12T19:00:00+00:00"
    assert first["has_no_travel"] is False
    assert first["warnings"] == []
    assert set(first["miles_by_level"]) == {"low", "moderate", "high", "severe", "no_travel"}
    assert first["miles_by_level"]["low"] == 700
    assert all(len(pair) == 2 for pair in first["geometry"])

    checkpoint = first["checkpoints"][0]
    assert checkpoint == {
        "mile": 0,
        "lat": DALLAS[0],
        "lon": DALLAS[1],
        "eta": "2026-11-12T08:00:00+00:00",
        "level": 0,
        "level_label": "Low",
        "wind_mph": 5,
        "rain_in_hr": 0,
        "snow_in_hr": 0,
        "reasons": [],
    }

    heatmap = body["heatmap"]
    assert heatmap["start"] == "2026-11-12T08:00:00+00:00"
    assert heatmap["hours"] == 49
    assert all(len(p["levels"]) == 49 for p in heatmap["points"])


def test_plan_reports_no_travel_with_a_critical_warning(
    client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    stormy = FakeWeather(lambda _p, _t: WeatherSample(60, 0, 0))
    service = PlanTripService(FakeRouting([DIRECT]), stormy, clock=lambda: NOW)
    monkeypatch.setattr(dependencies, "get_plan_service", lambda: service)
    body = client.post("/api/v1/plan", BODY, format="json").json()
    assert body["recommended_is_safe"] is False
    route_ = body["routes"][0]
    assert route_["has_no_travel"] is True
    assert route_["warnings"][0]["severity"] == "critical"
    assert "NO TRAVEL" in route_["warnings"][0]["message"]
    assert route_["checkpoints"][0]["level_label"] == "No Travel"
    assert route_["miles_by_level"]["no_travel"] == 700


def test_times_are_reported_in_whole_seconds(client: APIClient, use_fakes: None) -> None:
    body = {**BODY, "departure": "2026-11-12T08:00:00.987654Z"}
    response = client.post("/api/v1/plan", body, format="json").json()
    assert response["departure"] == "2026-11-12T08:00:00+00:00"
    assert response["routes"][0]["checkpoints"][0]["eta"] == "2026-11-12T08:00:00+00:00"


def test_the_interval_defaults_to_25_miles(client: APIClient, use_fakes: None) -> None:
    body = {k: v for k, v in BODY.items() if k != "interval_miles"}
    response = client.post("/api/v1/plan", body, format="json")
    assert response.status_code == 200
    assert response.json()["interval_miles"] == 25


def test_a_departure_with_an_offset_is_accepted(client: APIClient, use_fakes: None) -> None:
    body = {**BODY, "departure": "2026-11-12T02:00:00-06:00"}
    assert client.post("/api/v1/plan", body, format="json").status_code == 200


def test_every_response_carries_a_request_id(client: APIClient, use_fakes: None) -> None:
    assert client.post("/api/v1/plan", BODY, format="json")["X-Request-ID"]


@pytest.mark.parametrize(
    ("field", "value"),
    [
        ("departure", "2026-11-12T08:00:00"),  # no UTC offset
        ("departure", "tomorrow"),
        ("departure", 12),
        ("load_lbs", 0),
        ("load_lbs", 120_001),
        ("interval_miles", 30),
        ("origin", {"lat": 91, "lon": 0}),
        ("destination", {"lat": 0, "lon": 181}),
        ("origin", {"lat": 10}),
    ],
)
def test_invalid_input_is_rejected_with_field_errors(
    client: APIClient, use_fakes: None, field: str, value: object
) -> None:
    response = client.post("/api/v1/plan", {**BODY, field: value}, format="json")
    assert response.status_code == 400
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert field in error["details"]


def test_missing_fields_are_each_reported(client: APIClient, use_fakes: None) -> None:
    response = client.post("/api/v1/plan", {}, format="json")
    assert response.status_code == 400
    assert set(response.json()["error"]["details"]) == {
        "origin",
        "destination",
        "departure",
        "load_lbs",
    }


@pytest.mark.parametrize(
    ("error", "http_status", "code"),
    [
        (InvalidTripRequestError("bad trip"), 400, "invalid_trip_request"),
        (NoRouteFoundError("no route"), 404, "no_route_found"),
        (ForecastOutOfRangeError("too far"), 422, "forecast_out_of_range"),
        (RateLimitedError("slow down"), 429, "upstream_rate_limited"),
        (UpstreamUnavailableError("down"), 502, "upstream_unavailable"),
    ],
)
def test_domain_errors_map_to_the_error_envelope(
    client: APIClient,
    monkeypatch: pytest.MonkeyPatch,
    error: DomainError,
    http_status: int,
    code: str,
) -> None:
    monkeypatch.setattr(dependencies, "get_plan_service", lambda: RaisingService(error))
    response = client.post("/api/v1/plan", BODY, format="json")
    assert response.status_code == http_status
    assert response.json() == {"error": {"code": code, "message": str(error), "details": None}}


def test_the_plan_endpoint_is_throttled(client: APIClient) -> None:
    statuses = [client.post("/api/v1/plan", {}, format="json").status_code for _ in range(11)]
    assert statuses[:10] == [400] * 10
    assert statuses[10] == 429
    last = client.post("/api/v1/plan", {}, format="json").json()
    assert last["error"]["code"] == "rate_limited"


def test_plan_only_accepts_post(client: APIClient) -> None:
    assert client.get("/api/v1/plan").status_code == 405


def test_openapi_schema_documents_both_endpoints(client: APIClient) -> None:
    response = client.get("/api/schema/")
    assert response.status_code == 200
    assert b"/api/v1/plan" in response.content
    assert b"/api/v1/geocode" in response.content
    assert b"PlanResponse" in response.content


def test_swagger_ui_is_served(client: APIClient) -> None:
    assert client.get("/api/docs/").status_code == 200


def test_server_error_handler_returns_the_envelope() -> None:
    from django.test import RequestFactory  # noqa: PLC0415

    from apps.trips.api.views import server_error  # noqa: PLC0415

    response = server_error(RequestFactory().get("/boom"))
    assert response.status_code == 500
    assert b'"code": "server_error"' in response.content


def test_departure_in_the_past_is_a_domain_error(client: APIClient, use_fakes: None) -> None:
    body = {**BODY, "departure": (NOW - timedelta(days=2)).isoformat()}
    response = client.post("/api/v1/plan", body, format="json")
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "invalid_trip_request"
