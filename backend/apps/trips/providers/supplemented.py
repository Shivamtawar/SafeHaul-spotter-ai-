"""Routing that tops up a primary provider's routes with distinct alternates from a second one."""

import logging

from apps.trips.domain.errors import NoRouteFoundError, RateLimitedError, UpstreamUnavailableError
from apps.trips.domain.geometry import LatLon, overlap_fraction

from .ports import RouteOption, RoutingProvider

logger = logging.getLogger(__name__)

TARGET_ROUTES = 3
DUPLICATE_OVERLAP = 0.9  # a candidate this similar to a kept route is the same road


class SupplementedRouting:
    """OpenRouteService is the primary source. It refuses alternative routes beyond 100 km, so
    when it returns fewer than three, a second provider fills the gap with routes that are
    genuinely different. If the second provider fails, the primary routes are still returned; if
    the primary is unavailable, the second provider serves the whole request.
    """

    def __init__(self, primary: RoutingProvider, supplement: RoutingProvider) -> None:
        self._primary = primary
        self._supplement = supplement

    def routes(self, origin: LatLon, destination: LatLon, *, load_lbs: float) -> list[RouteOption]:
        try:
            kept = self._primary.routes(origin, destination, load_lbs=load_lbs)[:TARGET_ROUTES]
        except UpstreamUnavailableError, RateLimitedError:
            logger.warning("primary_routing_unavailable")
            return self._supplement.routes(origin, destination, load_lbs=load_lbs)[:TARGET_ROUTES]
        if len(kept) >= TARGET_ROUTES:
            return kept

        try:
            candidates = self._supplement.routes(origin, destination, load_lbs=load_lbs)
        except NoRouteFoundError, UpstreamUnavailableError, RateLimitedError:
            logger.warning("supplementary_routing_unavailable", extra={"routes": len(kept)})
            return kept

        for candidate in candidates:
            if len(kept) >= TARGET_ROUTES:
                break
            if all(_is_distinct(candidate, route) for route in kept):
                kept.append(candidate)
        return kept


def _is_distinct(candidate: RouteOption, existing: RouteOption) -> bool:
    return overlap_fraction(candidate.geometry, existing.geometry) < DUPLICATE_OVERLAP
