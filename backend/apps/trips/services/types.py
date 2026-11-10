"""Input and output types of the trip-planning use case."""

from dataclasses import dataclass
from datetime import datetime

from apps.trips.domain.geometry import LatLon
from apps.trips.domain.models import RouteAssessment
from apps.trips.domain.risk import RiskLevel
from apps.trips.domain.warnings import RouteWarning


@dataclass(frozen=True, slots=True)
class TripRequest:
    origin: LatLon
    destination: LatLon
    departure: datetime  # timezone-aware
    load_lbs: float
    interval_miles: float


@dataclass(frozen=True, slots=True)
class PlannedRoute:
    rank: int  # 1 is best
    assessment: RouteAssessment
    arrival: datetime
    geometry: tuple[LatLon, ...]  # simplified for display
    warnings: tuple[RouteWarning, ...]

    @property
    def route_id(self) -> str:
        return self.assessment.route_id


@dataclass(frozen=True, slots=True)
class HeatmapPoint:
    position: LatLon
    levels: tuple[RiskLevel, ...]  # one per hour, starting at ``Heatmap.start``


@dataclass(frozen=True, slots=True)
class Heatmap:
    start: datetime  # the hour of departure; ``levels[h]`` is h hours later
    points: tuple[HeatmapPoint, ...]


@dataclass(frozen=True, slots=True)
class TripPlan:
    request: TripRequest
    routes: tuple[PlannedRoute, ...]  # ranked best first
    heatmap: Heatmap

    @property
    def recommended(self) -> PlannedRoute:
        return self.routes[0]

    @property
    def recommended_is_safe(self) -> bool:
        """False when every route contains No Travel weather, so even the best is unsafe."""
        return not self.recommended.assessment.has_no_travel
