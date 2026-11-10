"""Ports: what the services need from the outside world, independent of any vendor."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol

from apps.trips.domain.forecast import HourlyForecast
from apps.trips.domain.geometry import LatLon


@dataclass(frozen=True, slots=True)
class Place:
    label: str
    position: LatLon


@dataclass(frozen=True, slots=True)
class RouteOption:
    """One candidate route as the routing provider describes it."""

    geometry: tuple[LatLon, ...]
    distance_miles: float
    duration_seconds: float
    steps: tuple[tuple[float, float], ...]  # (distance, duration_seconds) in route order


class RoutingProvider(Protocol):
    def routes(self, origin: LatLon, destination: LatLon, *, load_lbs: float) -> list[RouteOption]:
        """Up to three alternative truck routes, best-first as the provider ranks them."""
        ...


class GeocodingProvider(Protocol):
    def search(self, query: str, limit: int = 5) -> list[Place]: ...


class WeatherProvider(Protocol):
    def hourly(
        self, points: Sequence[LatLon], start: datetime, end: datetime
    ) -> list[HourlyForecast]:
        """Hourly forecasts covering ``start``..``end`` (UTC), aligned with ``points``."""
        ...
