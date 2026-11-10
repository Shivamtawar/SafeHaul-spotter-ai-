from rest_framework.test import APIClient


def test_healthz_returns_ok_and_request_id() -> None:
    response = APIClient().get("/healthz", HTTP_X_REQUEST_ID="abc123")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert response["X-Request-ID"] == "abc123"
