import pytest
from rest_framework.test import APIClient

from apps.trips.api import dependencies
from apps.trips.domain.errors import UpstreamUnavailableError
from apps.trips.providers.ports import Place


class FakeGeocoder:
    def __init__(self, places: list[Place] | None = None, error: Exception | None = None) -> None:
        self.places = places or []
        self.error = error
        self.queries: list[str] = []

    def search(self, query: str, limit: int = 5) -> list[Place]:
        self.queries.append(query)
        if self.error:
            raise self.error
        return self.places


@pytest.fixture
def client() -> APIClient:
    return APIClient()


def use(monkeypatch: pytest.MonkeyPatch, geocoder: FakeGeocoder) -> None:
    monkeypatch.setattr(dependencies, "get_geocoder", lambda: geocoder)


def test_geocode_returns_matching_places(
    client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    geocoder = FakeGeocoder([Place("Dallas, Texas, United States", (32.776, -96.797))])
    use(monkeypatch, geocoder)
    response = client.get("/api/v1/geocode", {"q": "Dallas"})
    assert response.status_code == 200
    assert response.json() == [
        {"name": "Dallas, Texas, United States", "lat": 32.776, "lon": -96.797}
    ]
    assert geocoder.queries == ["Dallas"]


@pytest.mark.parametrize("params", [{}, {"q": ""}, {"q": "ab"}, {"q": "x" * 201}])
def test_geocode_validates_the_query(
    client: APIClient, monkeypatch: pytest.MonkeyPatch, params: dict[str, str]
) -> None:
    use(monkeypatch, FakeGeocoder())
    response = client.get("/api/v1/geocode", params)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "validation_error"


def test_geocode_reports_upstream_failures(
    client: APIClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    use(monkeypatch, FakeGeocoder(error=UpstreamUnavailableError("Search is down.")))
    response = client.get("/api/v1/geocode", {"q": "Dallas"})
    assert response.status_code == 502
    assert response.json()["error"]["code"] == "upstream_unavailable"
