"""Truck routes from a Valhalla server (the public OSM instance, or a self-hosted one).

Used to supply the alternative routes OpenRouteService will not compute on long trips.
"""

from typing import Any

from django.core.cache.backends.base import BaseCache

from apps.trips.domain.errors import NoRouteFoundError, UpstreamUnavailableError
from apps.trips.domain.geometry import LatLon

from .cache import cache_key, get_or_set
from .http import HttpClient
from .polyline import decode_polyline
from .ports import RouteOption

POUNDS_TO_TONNES = 0.000453592
ALTERNATES = 2  # the best route plus two alternates
BAD_RESPONSE = "The alternate-routes service returned an unexpected response."


class ValhallaRouting:
    def __init__(self, http: HttpClient, base_url: str, cache: BaseCache, ttl: int) -> None:
        self._http = http
        self._url = f"{base_url.rstrip('/')}/route"
        self._cache = cache
        self._ttl = ttl

    def routes(self, origin: LatLon, destination: LatLon, *, load_lbs: float) -> list[RouteOption]:
        tonnes = max(round(load_lbs * POUNDS_TO_TONNES), 1)
        coordinates = [round(v, 4) for v in (*origin, *destination)]
        key = cache_key("valhalla", *coordinates, tonnes)
        return get_or_set(
            self._cache, key, self._ttl, lambda: self._fetch(origin, destination, tonnes)
        )

    def _fetch(self, origin: LatLon, destination: LatLon, tonnes: int) -> list[RouteOption]:
        payload: dict[str, Any] = {
            "locations": [
                {"lat": origin[0], "lon": origin[1]},
                {"lat": destination[0], "lon": destination[1]},
            ],
            "costing": "truck",
            "costing_options": {"truck": {"weight": tonnes}},
            "alternates": ALTERNATES,
            "units": "miles",
        }
        response = self._http.post_json(self._url, payload)
        if response.status == 400:
            raise NoRouteFoundError("No truck route could be found between these places.")
        if response.status != 200:
            raise UpstreamUnavailableError("The alternate-routes service returned an error.")
        try:
            alternates = response.body.get("alternates", [])
            trips = [response.body["trip"], *(a["trip"] for a in alternates)]
            return [_parse_trip(trip) for trip in trips]
        except (KeyError, IndexError, TypeError, AttributeError) as exc:
            raise UpstreamUnavailableError(BAD_RESPONSE) from exc


def _parse_trip(trip: dict[str, Any]) -> RouteOption:
    leg = trip["legs"][0]
    return RouteOption(
        geometry=tuple(decode_polyline(leg["shape"])),
        distance_miles=float(trip["summary"]["length"]),
        duration_seconds=float(trip["summary"]["time"]),
        steps=tuple((float(m["length"]), float(m["time"])) for m in leg["maneuvers"]),
    )
