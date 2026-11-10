"""One error envelope for every API failure: ``{"error": {"code", "message", "details"}}``."""

import logging
from typing import Any

from rest_framework import exceptions, status
from rest_framework.response import Response
from rest_framework.views import exception_handler

from apps.trips.domain.errors import (
    DomainError,
    ForecastOutOfRangeError,
    InvalidTripRequestError,
    NoRouteFoundError,
    RateLimitedError,
    UpstreamUnavailableError,
)

logger = logging.getLogger(__name__)

DOMAIN_STATUS: dict[type[DomainError], int] = {
    InvalidTripRequestError: status.HTTP_400_BAD_REQUEST,
    NoRouteFoundError: status.HTTP_404_NOT_FOUND,
    ForecastOutOfRangeError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    RateLimitedError: status.HTTP_429_TOO_MANY_REQUESTS,
    UpstreamUnavailableError: status.HTTP_502_BAD_GATEWAY,
}


def error_response(code: str, message: str, http_status: int, details: Any = None) -> Response:
    return Response(
        {"error": {"code": code, "message": message, "details": details}}, status=http_status
    )


def api_exception_handler(exc: Exception, context: dict[str, Any]) -> Response | None:
    if isinstance(exc, DomainError):
        http_status = DOMAIN_STATUS.get(type(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)
        server_side = http_status >= status.HTTP_500_INTERNAL_SERVER_ERROR
        if server_side or isinstance(exc, RateLimitedError):
            logger.warning("domain_error", extra={"code": exc.code, "detail": str(exc)})
        return error_response(exc.code, str(exc), http_status)

    response = exception_handler(exc, context)
    if response is None:
        return None
    if isinstance(exc, exceptions.ValidationError):
        return error_response(
            "validation_error", "The request was invalid.", status.HTTP_400_BAD_REQUEST, exc.detail
        )
    if isinstance(exc, exceptions.Throttled):
        return error_response(
            "rate_limited", "Too many requests. Please retry shortly.", response.status_code
        )
    detail = exc.detail if isinstance(exc, exceptions.APIException) else None
    return error_response(getattr(exc, "default_code", "error"), str(detail), response.status_code)
