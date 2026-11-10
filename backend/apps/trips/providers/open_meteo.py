"""Hourly wind, rain and snow from the Open-Meteo forecast API (free, no key)."""

from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from django.core.cache.backends.base import BaseCache

from apps.trips.domain.errors import ForecastOutOfRangeError, UpstreamUnavailableError
from apps.trips.domain.forecast import HourlyForecast
from apps.trips.domain.geometry import LatLon
from apps.trips.domain.risk import WeatherSample

from .cache import cache_key
from .http import HttpClient

HOURLY_FIELDS = ("wind_speed_10m", "rain", "snowfall")
BATCH_SIZE = 100  # locations per request keeps the URL short and responses small
COORDINATE_DECIMALS = 2  # about 0.7 miles; also the de-duplication and cache granularity
TIME_FORMAT = "%Y-%m-%dT%H:%M"


class OpenMeteoWeather:
    def __init__(self, http: HttpClient, base_url: str, cache: BaseCache, ttl: int) -> None:
        self._http = http
        self._url = f"{base_url.rstrip('/')}/v1/forecast"
        self._cache = cache
        self._ttl = ttl

    def hourly(
        self, points: Sequence[LatLon], start: datetime, end: datetime
    ) -> list[HourlyForecast]:
        first_day, last_day = start.astimezone(UTC).date(), end.astimezone(UTC).date()
        rounded = [_round(p) for p in points]
        keys = {p: cache_key("open-meteo", *p, first_day, last_day) for p in dict.fromkeys(rounded)}

        found: dict[LatLon, HourlyForecast] = {}
        missing: list[LatLon] = []
        for point, key in keys.items():
            cached: HourlyForecast | None = self._cache.get(key)
            if cached is None:
                missing.append(point)
            else:
                found[point] = cached

        for offset in range(0, len(missing), BATCH_SIZE):
            batch = missing[offset : offset + BATCH_SIZE]
            for point, forecast in zip(batch, self._fetch(batch, first_day, last_day), strict=True):
                found[point] = forecast
                self._cache.set(keys[point], forecast, self._ttl)
        return [found[p] for p in rounded]

    def _fetch(self, batch: list[LatLon], first_day: Any, last_day: Any) -> list[HourlyForecast]:
        response = self._http.get_json(
            self._url,
            {
                "latitude": ",".join(str(lat) for lat, _ in batch),
                "longitude": ",".join(str(lon) for _, lon in batch),
                "hourly": ",".join(HOURLY_FIELDS),
                "wind_speed_unit": "mph",
                "precipitation_unit": "inch",
                "timezone": "UTC",
                "start_date": first_day.isoformat(),
                "end_date": last_day.isoformat(),
            },
        )
        if response.status == 400:
            raise ForecastOutOfRangeError("No forecast is available for those dates.")
        if response.status != 200:
            raise UpstreamUnavailableError("The weather service returned an error.")
        # One location is answered with an object, several with a list.
        body = response.body if isinstance(response.body, list) else [response.body]
        if len(body) != len(batch):
            raise UpstreamUnavailableError("The weather service returned an unexpected response.")
        try:
            return [_parse_location(item) for item in body]
        except (KeyError, TypeError, ValueError) as exc:
            raise UpstreamUnavailableError(
                "The weather service returned an unexpected response."
            ) from exc


def _round(point: LatLon) -> LatLon:
    return (round(point[0], COORDINATE_DECIMALS), round(point[1], COORDINATE_DECIMALS))


def _parse_location(item: dict[str, Any]) -> HourlyForecast:
    hourly = item["hourly"]
    winds, rains, snows = (hourly[field] for field in HOURLY_FIELDS)
    if any(v is None for series in (winds, rains, snows) for v in series):
        raise ValueError("incomplete forecast")
    return HourlyForecast(
        start=datetime.strptime(hourly["time"][0], TIME_FORMAT).replace(tzinfo=UTC),
        samples=tuple(
            WeatherSample(wind_mph=w, rain_in_hr=r, snow_in_hr=s)
            for w, r, s in zip(winds, rains, snows, strict=True)
        ),
    )
