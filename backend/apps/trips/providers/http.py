"""Shared outbound HTTP client: timeouts, retries, typed errors and timing logs."""

import logging
import time
from dataclasses import dataclass
from typing import Any

import requests
from tenacity import (
    RetryCallState,
    Retrying,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)
from tenacity.wait import wait_base

from apps.trips.domain.errors import RateLimitedError, UpstreamUnavailableError

logger = logging.getLogger(__name__)

TRANSIENT_STATUSES = frozenset({502, 503, 504})
MAX_ATTEMPTS = 3


class _TransientError(Exception):
    """Internal marker: the request is worth retrying."""


@dataclass(frozen=True, slots=True)
class JsonResponse:
    status: int
    body: Any


class HttpClient:
    """Calls one upstream service. 4xx (except 429) is returned so adapters can interpret it."""

    def __init__(
        self,
        name: str,
        *,
        timeout: float,
        user_agent: str,
        session: requests.Session | None = None,
        wait: wait_base | None = None,
    ) -> None:
        self._name = name
        self._timeout = timeout
        self._session = session or requests.Session()
        self._session.headers["User-Agent"] = user_agent
        self._wait = wait or wait_exponential(multiplier=0.5, max=4)

    def get_json(self, url: str, params: dict[str, Any] | None = None) -> JsonResponse:
        return self._send("GET", url, params=params)

    def post_json(self, url: str, payload: dict[str, Any]) -> JsonResponse:
        return self._send("POST", url, json=payload)

    def _send(self, method: str, url: str, **kwargs: Any) -> JsonResponse:
        retrying = Retrying(
            retry=retry_if_exception_type(_TransientError),
            stop=stop_after_attempt(MAX_ATTEMPTS),
            wait=self._wait,
            reraise=False,
            retry_error_callback=self._give_up,
        )
        result: JsonResponse = retrying(self._attempt, method, url, **kwargs)
        return result

    def _give_up(self, state: RetryCallState) -> None:
        logger.error("upstream_failed", extra={"upstream": self._name})
        raise UpstreamUnavailableError(f"{self._name} is not responding. Please try again.")

    def _attempt(self, method: str, url: str, **kwargs: Any) -> JsonResponse:
        started = time.monotonic()
        try:
            response = self._session.request(method, url, timeout=self._timeout, **kwargs)
        except requests.RequestException as exc:
            self._log(None, started, error=type(exc).__name__)
            raise _TransientError from exc
        self._log(response.status_code, started)

        if response.status_code == 429:
            raise RateLimitedError(f"{self._name} rate limit reached. Please retry shortly.")
        if response.status_code in TRANSIENT_STATUSES:
            raise _TransientError
        if response.status_code >= 500:
            raise UpstreamUnavailableError(f"{self._name} returned an error.")
        try:
            body = response.json()
        except ValueError as exc:
            raise UpstreamUnavailableError(
                f"{self._name} returned an unreadable response."
            ) from exc
        return JsonResponse(response.status_code, body)

    def _log(self, status: int | None, started: float, error: str | None = None) -> None:
        logger.info(
            "upstream_call",
            extra={
                "upstream": self._name,
                "status": status,
                "error": error,
                "duration_ms": round((time.monotonic() - started) * 1000),
            },
        )
