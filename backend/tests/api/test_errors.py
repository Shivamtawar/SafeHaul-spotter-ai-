from rest_framework import exceptions
from rest_framework.test import APIClient

from apps.trips.api.errors import api_exception_handler


def test_method_not_allowed_uses_error_envelope() -> None:
    response = APIClient().post("/healthz")
    assert response.status_code == 405
    body = response.json()
    assert body["error"]["code"] == "method_not_allowed"
    assert body["error"]["details"] is None


def test_validation_error_is_flattened_into_details() -> None:
    exc = exceptions.ValidationError({"load_lbs": ["Must be positive."]})
    response = api_exception_handler(exc, {"view": None, "request": None})
    assert response is not None
    assert response.status_code == 400
    assert response.data["error"] == {
        "code": "validation_error",
        "message": "The request was invalid.",
        "details": {"load_lbs": ["Must be positive."]},
    }


def test_throttled_error_is_rate_limited() -> None:
    response = api_exception_handler(exceptions.Throttled(), {"view": None, "request": None})
    assert response is not None
    assert response.status_code == 429
    assert response.data["error"]["code"] == "rate_limited"


def test_unhandled_exception_returns_none_so_django_reports_500() -> None:
    assert api_exception_handler(RuntimeError("boom"), {"view": None, "request": None}) is None
