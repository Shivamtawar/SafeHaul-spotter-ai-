import pytest
from django.core.exceptions import ImproperlyConfigured
from pytest_django import Settings

from apps.trips.api import dependencies
from apps.trips.providers.ors import OrsGeocoder
from apps.trips.services.plan_trip import PlanTripService


@pytest.fixture(autouse=True)
def _fresh_builders() -> None:
    dependencies.get_plan_service.cache_clear()
    dependencies.get_geocoder.cache_clear()


def test_the_plan_service_is_built_once_from_settings(settings: Settings) -> None:
    settings.ORS_API_KEY = "test-key"
    service = dependencies.get_plan_service()
    assert isinstance(service, PlanTripService)
    assert dependencies.get_plan_service() is service


def test_the_geocoder_is_built_once_and_sends_the_api_key(settings: Settings) -> None:
    settings.ORS_API_KEY = "test-key"
    geocoder = dependencies.get_geocoder()
    assert isinstance(geocoder, OrsGeocoder)
    assert dependencies.get_geocoder() is geocoder
    assert geocoder._http._session.headers["Authorization"] == "test-key"


def test_whitespace_around_the_api_key_is_ignored(settings: Settings) -> None:
    settings.ORS_API_KEY = "  test-key\n"
    geocoder = dependencies.get_geocoder()
    assert geocoder._http._session.headers["Authorization"] == "test-key"


def test_a_blank_api_key_fails_loudly(settings: Settings) -> None:
    settings.ORS_API_KEY = "   "
    with pytest.raises(ImproperlyConfigured, match="ORS_API_KEY"):
        dependencies.get_geocoder()


def test_a_missing_api_key_fails_loudly(settings: Settings) -> None:
    settings.ORS_API_KEY = ""
    with pytest.raises(ImproperlyConfigured, match="ORS_API_KEY"):
        dependencies.get_plan_service()
    with pytest.raises(ImproperlyConfigured, match="ORS_API_KEY"):
        dependencies.get_geocoder()
