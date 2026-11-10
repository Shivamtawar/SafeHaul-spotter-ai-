"""Use case: plan a truck trip. Pulls routes and weather through ports, applies the domain rules."""

import logging
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from apps.trips.domain.errors import (
    ForecastOutOfRangeError,
    InvalidTripRequestError,
    NoRouteFoundError,
)
from apps.trips.domain.forecast import ONE_HOUR, HourlyForecast
from apps.trips.domain.geometry import (
    LatLon,
    checkpoint_miles,
    cumulative_miles,
    haversine_miles,
    point_at_mile,
    simplify,
)
from apps.trips.domain.models import CheckpointInput, RouteAssessment
from apps.trips.domain.ranking import assess_route, rank_routes
from apps.trips.domain.risk import assess
from apps.trips.domain.timing import TravelProfile
from apps.trips.domain.warnings import route_warnings
from apps.trips.providers.ports import RouteOption, RoutingProvider, WeatherProvider

from .types import Heatmap, HeatmapPoint, PlannedRoute, TripPlan, TripRequest

logger = logging.getLogger(__name__)

MAX_ROUTES = 3
HEATMAP_HOURS = 48
MAX_FORECAST_DAYS = 15  # Open-Meteo serves today plus 15 days
PAST_TOLERANCE = timedelta(hours=6)  # lets "leave now" through despite form and network delay
MIN_TRIP_MILES = 1.0
DISPLAY_TOLERANCE_MILES = 0.1  # geometry simplification for the map
HEATMAP_PRECISION = 2  # points closer than this (about 0.7 mi) share one heatmap cell


@dataclass(frozen=True, slots=True)
class _Sample:
    mile: float
    position: LatLon
    eta: datetime


class PlanTripService:
    def __init__(
        self,
        routing: RoutingProvider,
        weather: WeatherProvider,
        clock: Callable[[], datetime] = lambda: datetime.now(UTC),
    ) -> None:
        self._routing = routing
        self._weather = weather
        self._clock = clock

    def plan(self, request: TripRequest) -> TripPlan:
        now = self._clock()
        self._validate(request, now)

        options = [
            o
            for o in self._routing.routes(
                request.origin, request.destination, load_lbs=request.load_lbs
            )
            if o.distance_miles > 0
        ][:MAX_ROUTES]
        if not options:
            raise NoRouteFoundError("No truck route could be found between these places.")

        profiles = [_profile(o) for o in options]
        sampled = [
            _sample(o, p, request.departure, request.interval_miles)
            for o, p in zip(options, profiles, strict=True)
        ]

        window_start, window_end = _forecast_window(sampled, request.departure, now)

        positions = [s.position for samples in sampled for s in samples]
        forecasts = self._weather.hourly(positions, window_start, window_end)

        assessments = _assess_routes(options, sampled, forecasts, request.load_lbs)
        ranked = rank_routes(assessments)
        by_id = {a.route_id: (o, p) for a, o, p in zip(assessments, options, profiles, strict=True)}
        planned = tuple(
            PlannedRoute(
                rank=rank,
                assessment=a,
                arrival=request.departure + timedelta(seconds=by_id[a.route_id][1].total_seconds),
                geometry=tuple(simplify(by_id[a.route_id][0].geometry, DISPLAY_TOLERANCE_MILES)),
                warnings=route_warnings(a),
            )
            for rank, a in enumerate(ranked, start=1)
        )
        heatmap = _heatmap(positions, forecasts, window_start, request.load_lbs)
        logger.info(
            "trip_planned",
            extra={
                "routes": len(planned),
                "checkpoints": len(positions),
                "recommended_is_safe": not planned[0].assessment.has_no_travel,
            },
        )
        return TripPlan(request=request, routes=planned, heatmap=heatmap)

    @staticmethod
    def _validate(request: TripRequest, now: datetime) -> None:
        if request.departure < now - PAST_TOLERANCE:
            raise InvalidTripRequestError("The departure time is in the past.")
        if request.load_lbs <= 0:
            raise InvalidTripRequestError("The load weight must be greater than zero.")
        if request.interval_miles <= 0:
            raise InvalidTripRequestError("The checkpoint interval must be greater than zero.")
        if haversine_miles(request.origin, request.destination) < MIN_TRIP_MILES:
            raise InvalidTripRequestError("The origin and destination are too close together.")


def _forecast_window(
    sampled: Sequence[Sequence[_Sample]], departure: datetime, now: datetime
) -> tuple[datetime, datetime]:
    """UTC hours of weather needed: the whole trip or the 48-hour heatmap, whichever is longer."""
    start = departure.astimezone(UTC).replace(minute=0, second=0, microsecond=0)
    last_eta = max(s.eta for samples in sampled for s in samples)
    end = max(last_eta.astimezone(UTC), start + HEATMAP_HOURS * ONE_HOUR) + ONE_HOUR
    if end.date() > (now + timedelta(days=MAX_FORECAST_DAYS)).astimezone(UTC).date():
        raise ForecastOutOfRangeError(
            f"Weather forecasts cover about {MAX_FORECAST_DAYS} days. This trip and the "
            f"{HEATMAP_HOURS}-hour forecast view reach past that. Choose an earlier departure."
        )
    return start, end


def _profile(option: RouteOption) -> TravelProfile:
    steps: Sequence[tuple[float, float]] = option.steps
    if not steps or sum(distance for distance, _ in steps) <= 0:
        steps = ((option.distance_miles, option.duration_seconds),)
    return TravelProfile.from_steps(steps)


def _assess_routes(
    options: Sequence[RouteOption],
    sampled: Sequence[Sequence[_Sample]],
    forecasts: Sequence[HourlyForecast],
    load_lbs: float,
) -> list[RouteAssessment]:
    """Read each checkpoint's forecast at its ETA and judge every route. ``forecasts`` is flat."""
    assessments = []
    cursor = 0
    for index, (option, samples) in enumerate(zip(options, sampled, strict=True), start=1):
        route_forecasts = forecasts[cursor : cursor + len(samples)]
        cursor += len(samples)
        inputs = [
            CheckpointInput(s.mile, s.position, s.eta, f.at(s.eta))
            for s, f in zip(samples, route_forecasts, strict=True)
        ]
        assessments.append(
            assess_route(
                f"route-{index}", option.distance_miles, option.duration_seconds, inputs, load_lbs
            )
        )
    return assessments


def _sample(
    option: RouteOption, profile: TravelProfile, departure: datetime, interval_miles: float
) -> list[_Sample]:
    cumulative = cumulative_miles(option.geometry)
    geometry_miles = cumulative[-1]
    samples = []
    for mile in checkpoint_miles(option.distance_miles, interval_miles):
        fraction = mile / option.distance_miles
        samples.append(
            _Sample(
                mile=mile,
                position=point_at_mile(option.geometry, cumulative, fraction * geometry_miles),
                eta=profile.eta(departure, fraction),
            )
        )
    return samples


def _heatmap(
    positions: Sequence[LatLon],
    forecasts: Sequence[HourlyForecast],
    start: datetime,
    load_lbs: float,
) -> Heatmap:
    """Risk at every sampled place for each of the next 48 hours, so the UI never refetches."""
    cells: dict[LatLon, HeatmapPoint] = {}
    for position, forecast in zip(positions, forecasts, strict=True):
        cell = (round(position[0], HEATMAP_PRECISION), round(position[1], HEATMAP_PRECISION))
        if cell in cells:
            continue
        levels = tuple(
            assess(forecast.at(start + hour * ONE_HOUR), load_lbs).level
            for hour in range(HEATMAP_HOURS + 1)
        )
        cells[cell] = HeatmapPoint(position=position, levels=levels)
    return Heatmap(start=start, points=tuple(cells.values()))
