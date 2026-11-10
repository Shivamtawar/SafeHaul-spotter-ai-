"""Typed failures raised by the domain, providers and services. The API layer maps them to HTTP."""


class DomainError(Exception):
    """Base class. ``code`` is a stable machine-readable identifier for API clients."""

    code = "error"


class InvalidTripRequestError(DomainError):
    code = "invalid_trip_request"


class NoRouteFoundError(DomainError):
    code = "no_route_found"


class ForecastOutOfRangeError(DomainError):
    code = "forecast_out_of_range"


class UpstreamUnavailableError(DomainError):
    code = "upstream_unavailable"


class RateLimitedError(DomainError):
    code = "upstream_rate_limited"
