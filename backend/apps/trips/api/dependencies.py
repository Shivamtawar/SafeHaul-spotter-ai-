"""Composition root: builds the services from settings. Views depend on these functions only."""

from functools import cache

import requests
from django.conf import settings
from django.core.cache import cache as django_cache
from django.core.exceptions import ImproperlyConfigured

from apps.trips.providers.http import HttpClient
from apps.trips.providers.open_meteo import OpenMeteoWeather
from apps.trips.providers.ors import OrsGeocoder, OrsRouting
from apps.trips.providers.ports import GeocodingProvider
from apps.trips.providers.supplemented import SupplementedRouting
from apps.trips.providers.valhalla import ValhallaRouting
from apps.trips.services.plan_trip import PlanTripService


def _http(name: str, *, authorized: bool = False) -> HttpClient:
    session = requests.Session()
    if authorized:
        api_key = settings.ORS_API_KEY.strip()  # tolerate stray spaces or a newline in .env
        if not api_key:
            raise ImproperlyConfigured("ORS_API_KEY is not set. See backend/.env.example.")
        session.headers["Authorization"] = api_key
    return HttpClient(
        name,
        timeout=settings.HTTP_TIMEOUT_SECONDS,
        user_agent=settings.HTTP_USER_AGENT,
        session=session,
    )


@cache
def get_plan_service() -> PlanTripService:
    routing = SupplementedRouting(
        primary=OrsRouting(
            _http("Routing service", authorized=True),
            settings.ORS_BASE_URL,
            django_cache,
            settings.ROUTE_CACHE_TTL,
        ),
        supplement=ValhallaRouting(
            _http("Alternate-routes service"),
            settings.VALHALLA_BASE_URL,
            django_cache,
            settings.ROUTE_CACHE_TTL,
        ),
    )
    weather = OpenMeteoWeather(
        _http("Weather service"),
        settings.OPEN_METEO_BASE_URL,
        django_cache,
        settings.WEATHER_CACHE_TTL,
    )
    return PlanTripService(routing, weather)


@cache
def get_geocoder() -> GeocodingProvider:
    return OrsGeocoder(
        _http("Place search service", authorized=True),
        settings.ORS_BASE_URL,
        django_cache,
        settings.GEOCODE_CACHE_TTL,
    )
