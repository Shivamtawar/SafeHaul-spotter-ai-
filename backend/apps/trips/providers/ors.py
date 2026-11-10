"""Truck routing and place search through OpenRouteService (free API key)."""

import logging
from typing import Any

from django.core.cache.backends.base import BaseCache

from apps.trips.domain.errors import NoRouteFoundError, UpstreamUnavailableError
from apps.trips.domain.geometry import LatLon

from .cache import cache_key, get_or_set
from .http import HttpClient, JsonResponse
from .ports import Place, RouteOption

logger = logging.getLogger(__name__)

POUNDS_TO_TONNES = 0.000453592
PROFILE = "driving-hgv"
ALTERNATIVES = {"target_count": 3, "share_factor": 0.6, "weight_factor": 1.6}
BAD_ROUTE_RESPONSE = "The routing service returned an unexpected response."
BAD_PLACE_RESPONSE = "The place search service returned an unexpected response."
AUTH_FAILED = "The routing service rejected the API key."


class OrsRouting:
    def __init__(self, http: HttpClient, base_url: str, cache: BaseCache, ttl: int) -> None:
        self._http = http
        self._url = f"{base_url.rstrip('/')}/v2/directions/{PROFILE}/geojson"
        self._cache = cache
        self._ttl = ttl

    def routes(self, origin: LatLon, destination: LatLon, *, load_lbs: float) -> list[RouteOption]:
        tonnes = max(round(load_lbs * POUNDS_TO_TONNES), 1)
        coordinates = [round(v, 4) for v in (*origin, *destination)]
        key = cache_key("ors-route", *coordinates, tonnes)
        return get_or_set(
            self._cache, key, self._ttl, lambda: self._fetch(origin, destination, tonnes)
        )

    def _fetch(self, origin: LatLon, destination: LatLon, tonnes: int) -> list[RouteOption]:
        payload: dict[str, Any] = {
            "coordinates": [[origin[1], origin[0]], [destination[1], destination[0]]],
            "units": "mi",
            "instructions": True,
            "options": {"profile_params": {"restrictions": {"weight": tonnes}}},
        }
        response = self._http.post_json(self._url, {**payload, "alternative_routes": ALTERNATIVES})
        if response.status == 400:
            # ORS can refuse alternatives (for example on very long trips). A single route is
            # still useful, so ask again without them before giving up.
            logger.warning("alternatives_rejected", extra={"detail": _error_message(response)})
            response = self._http.post_json(self._url, payload)
        return _parse_routes(response)


def _parse_routes(response: JsonResponse) -> list[RouteOption]:
    if response.status in (400, 404):
        raise NoRouteFoundError("No truck route could be found between these places.")
    if response.status in (401, 403):
        logger.error("ors_auth_failed", extra={"status": response.status})
        raise UpstreamUnavailableError(AUTH_FAILED)
    if response.status != 200:
        raise UpstreamUnavailableError("The routing service returned an error.")
    try:
        return [_parse_feature(f) for f in response.body["features"]]
    except (KeyError, IndexError, TypeError) as exc:
        raise UpstreamUnavailableError(BAD_ROUTE_RESPONSE) from exc


def _parse_feature(feature: dict[str, Any]) -> RouteOption:
    summary = feature["properties"]["summary"]
    steps = [s for segment in feature["properties"]["segments"] for s in segment["steps"]]
    return RouteOption(
        geometry=tuple(
            (float(lat), float(lon)) for lon, lat, *_ in feature["geometry"]["coordinates"]
        ),
        distance_miles=float(summary["distance"]),
        duration_seconds=float(summary["duration"]),
        steps=tuple((float(s["distance"]), float(s["duration"])) for s in steps),
    )


def _error_message(response: JsonResponse) -> str:
    try:
        return str(response.body["error"]["message"])
    except KeyError, TypeError:
        return "unknown"


class OrsGeocoder:
    def __init__(self, http: HttpClient, base_url: str, cache: BaseCache, ttl: int) -> None:
        self._http = http
        self._url = f"{base_url.rstrip('/')}/geocode/autocomplete"
        self._cache = cache
        self._ttl = ttl

    def search(self, query: str, limit: int = 5) -> list[Place]:
        key = cache_key("ors-geocode", query.strip().lower(), limit)
        return get_or_set(self._cache, key, self._ttl, lambda: self._fetch(query.strip(), limit))

    def _fetch(self, query: str, limit: int) -> list[Place]:
        response = self._http.get_json(self._url, {"text": query, "size": limit})
        if response.status in (401, 403):
            logger.error("ors_auth_failed", extra={"status": response.status})
            raise UpstreamUnavailableError(AUTH_FAILED)
        if response.status != 200:
            raise UpstreamUnavailableError("The place search service returned an error.")
        try:
            return [place for f in response.body["features"] if (place := _parse_place(f))]
        except (KeyError, TypeError) as exc:
            raise UpstreamUnavailableError(BAD_PLACE_RESPONSE) from exc


def _parse_place(feature: dict[str, Any]) -> Place | None:
    coordinates = feature.get("geometry", {}).get("coordinates")
    label = feature.get("properties", {}).get("label")
    if not coordinates or len(coordinates) < 2 or not label:
        return None
    return Place(label=str(label), position=(float(coordinates[1]), float(coordinates[0])))
