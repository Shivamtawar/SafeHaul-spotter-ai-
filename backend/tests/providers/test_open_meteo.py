from datetime import UTC, datetime
from typing import Any
from urllib.parse import parse_qs, urlparse

import pytest
import responses
from django.core.cache.backends.base import BaseCache
from tenacity import wait_none

from apps.trips.domain.errors import ForecastOutOfRangeError, UpstreamUnavailableError
from apps.trips.domain.risk import WeatherSample
from apps.trips.providers.http import HttpClient
from apps.trips.providers.open_meteo import BATCH_SIZE, OpenMeteoWeather

BASE = "https://weather.test"
START = datetime(2026, 11, 12, 8, 30, tzinfo=UTC)
END = datetime(2026, 11, 13, 23, 0, tzinfo=UTC)


@pytest.fixture
def weather(cache: BaseCache) -> OpenMeteoWeather:
    http = HttpClient("Weather", timeout=1, user_agent="t", wait=wait_none())
    return OpenMeteoWeather(http, BASE, cache, ttl=60)


def location(wind: float = 10, rain: float = 0, snow: float = 0, hours: int = 3) -> dict[str, Any]:
    return {
        "hourly": {
            "time": [f"2026-11-12T{h:02d}:00" for h in range(hours)],
            "wind_speed_10m": [wind + h for h in range(hours)],
            "rain": [rain] * hours,
            "snowfall": [snow] * hours,
        }
    }


def query() -> dict[str, list[str]]:
    return parse_qs(urlparse(responses.calls[0].request.url).query)


@responses.activate
def test_single_location_answered_with_an_object(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=location(wind=20, rain=0.1, snow=0.5))
    (forecast,) = weather.hourly([(32.7767, -96.797)], START, END)
    assert forecast.start == datetime(2026, 11, 12, 0, 0, tzinfo=UTC)
    assert forecast.samples[1] == WeatherSample(wind_mph=21, rain_in_hr=0.1, snow_in_hr=0.5)


@responses.activate
def test_several_locations_answered_with_a_list_in_input_order(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=[location(wind=10), location(wind=50)])
    first, second = weather.hourly([(32.78, -96.8), (39.74, -104.99)], START, END)
    assert first.samples[0].wind_mph == 10
    assert second.samples[0].wind_mph == 50


@responses.activate
def test_requests_the_documented_units_and_date_window(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=[location(), location()])
    weather.hourly([(32.78, -96.8), (39.74, -104.99)], START, END)
    params = query()
    assert params["latitude"] == ["32.78,39.74"]
    assert params["longitude"] == ["-96.8,-104.99"]
    assert params["hourly"] == ["wind_speed_10m,rain,snowfall"]
    assert params["wind_speed_unit"] == ["mph"]
    assert params["precipitation_unit"] == ["inch"]
    assert params["timezone"] == ["UTC"]
    assert params["start_date"] == ["2026-11-12"]
    assert params["end_date"] == ["2026-11-13"]


@responses.activate
def test_points_within_the_same_cell_are_requested_once(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=location())
    forecasts = weather.hourly([(32.7801, -96.8001), (32.7799, -96.7999)], START, END)
    assert query()["latitude"] == ["32.78"]
    assert forecasts[0] == forecasts[1]


@responses.activate
def test_large_requests_are_split_into_batches(weather: OpenMeteoWeather) -> None:
    total = BATCH_SIZE + 20
    points = [(30 + i * 0.05, -100.0) for i in range(total)]

    def respond(request: Any) -> tuple[int, dict[str, str], str]:
        import json  # noqa: PLC0415

        count = len(parse_qs(urlparse(request.url).query)["latitude"][0].split(","))
        return 200, {}, json.dumps([location() for _ in range(count)])

    responses.add_callback(responses.GET, f"{BASE}/v1/forecast", callback=respond)
    forecasts = weather.hourly(points, START, END)
    assert len(forecasts) == total
    assert len(responses.calls) == 2


@responses.activate
def test_repeat_requests_are_served_from_cache(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=location())
    weather.hourly([(32.78, -96.8)], START, END)
    weather.hourly([(32.78, -96.8)], START, END)
    assert len(responses.calls) == 1


@responses.activate
def test_only_uncached_points_are_fetched(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=location())
    weather.hourly([(32.78, -96.8)], START, END)
    responses.replace(responses.GET, f"{BASE}/v1/forecast", json=location(wind=40))
    forecasts = weather.hourly([(32.78, -96.8), (39.74, -104.99)], START, END)
    assert query()["latitude"] == ["32.78"]  # first call
    assert parse_qs(urlparse(responses.calls[1].request.url).query)["latitude"] == ["39.74"]
    assert forecasts[0].samples[0].wind_mph == 10
    assert forecasts[1].samples[0].wind_mph == 40


@responses.activate
def test_a_different_date_window_is_not_a_cache_hit(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=location())
    weather.hourly([(32.78, -96.8)], START, END)
    weather.hourly([(32.78, -96.8)], START, datetime(2026, 11, 15, tzinfo=UTC))
    assert len(responses.calls) == 2


@responses.activate
def test_bad_request_means_the_dates_are_out_of_range(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", status=400, json={"error": True, "reason": "out of range"})
    with pytest.raises(ForecastOutOfRangeError):
        weather.hourly([(32.78, -96.8)], START, END)


@responses.activate
def test_other_statuses_are_upstream_failures(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", status=404, json={})
    with pytest.raises(UpstreamUnavailableError):
        weather.hourly([(32.78, -96.8)], START, END)


@responses.activate
def test_missing_values_are_an_upstream_failure(weather: OpenMeteoWeather) -> None:
    body = location()
    body["hourly"]["wind_speed_10m"][1] = None
    responses.get(f"{BASE}/v1/forecast", json=body)
    with pytest.raises(UpstreamUnavailableError, match="unexpected response"):
        weather.hourly([(32.78, -96.8)], START, END)


@responses.activate
def test_wrong_number_of_locations_is_an_upstream_failure(weather: OpenMeteoWeather) -> None:
    responses.get(f"{BASE}/v1/forecast", json=[location()])
    with pytest.raises(UpstreamUnavailableError, match="unexpected response"):
        weather.hourly([(32.78, -96.8), (39.74, -104.99)], START, END)
