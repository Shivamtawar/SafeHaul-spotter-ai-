import pytest
import requests
import responses
from tenacity import wait_none

from apps.trips.domain.errors import RateLimitedError, UpstreamUnavailableError
from apps.trips.providers.http import HttpClient

URL = "https://upstream.test/thing"


@pytest.fixture
def client() -> HttpClient:
    return HttpClient("Test service", timeout=1, user_agent="SafeHaul-tests", wait=wait_none())


@responses.activate
def test_get_json_returns_status_and_body(client: HttpClient) -> None:
    responses.get(URL, json={"ok": True})
    result = client.get_json(URL, {"q": "x"})
    assert (result.status, result.body) == (200, {"ok": True})
    assert responses.calls[0].request.url == f"{URL}?q=x"
    assert responses.calls[0].request.headers["User-Agent"] == "SafeHaul-tests"


@responses.activate
def test_post_json_sends_the_payload(client: HttpClient) -> None:
    responses.post(URL, json={"ok": True})
    client.post_json(URL, {"a": 1})
    assert responses.calls[0].request.body == b'{"a": 1}'


@responses.activate
def test_transient_errors_are_retried_until_success(client: HttpClient) -> None:
    responses.get(URL, status=503)
    responses.get(URL, body=requests.ConnectionError("reset"))
    responses.get(URL, json={"ok": True})
    assert client.get_json(URL).body == {"ok": True}
    assert len(responses.calls) == 3


@responses.activate
def test_gives_up_after_three_attempts(client: HttpClient) -> None:
    responses.get(URL, status=502)
    with pytest.raises(UpstreamUnavailableError, match="Test service is not responding"):
        client.get_json(URL)
    assert len(responses.calls) == 3


@responses.activate
def test_rate_limit_is_raised_without_retrying(client: HttpClient) -> None:
    responses.get(URL, status=429)
    with pytest.raises(RateLimitedError):
        client.get_json(URL)
    assert len(responses.calls) == 1


@responses.activate
def test_other_server_errors_are_not_retried(client: HttpClient) -> None:
    responses.get(URL, status=500)
    with pytest.raises(UpstreamUnavailableError):
        client.get_json(URL)
    assert len(responses.calls) == 1


@responses.activate
def test_client_errors_are_returned_for_the_adapter_to_interpret(client: HttpClient) -> None:
    responses.get(URL, status=400, json={"error": "bad"})
    result = client.get_json(URL)
    assert (result.status, result.body) == (400, {"error": "bad"})


@responses.activate
def test_unreadable_body_is_an_upstream_failure(client: HttpClient) -> None:
    responses.get(URL, body="<html>oops</html>")
    with pytest.raises(UpstreamUnavailableError, match="unreadable"):
        client.get_json(URL)
