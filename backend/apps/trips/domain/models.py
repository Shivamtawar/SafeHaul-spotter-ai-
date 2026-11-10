"""Immutable value objects exchanged between the domain, services and API layers."""

from dataclasses import dataclass
from datetime import datetime

from .geometry import LatLon
from .risk import RiskLevel, WeatherSample


@dataclass(frozen=True, slots=True)
class CheckpointInput:
    """A sampled point on a route, before its weather has been judged."""

    mile: float
    position: LatLon
    eta: datetime
    weather: WeatherSample


@dataclass(frozen=True, slots=True)
class Checkpoint:
    mile: float
    position: LatLon
    eta: datetime
    weather: WeatherSample
    level: RiskLevel
    reasons: tuple[str, ...]
    segment_miles: float  # road this checkpoint stands for (halfway to each neighbour)


@dataclass(frozen=True, slots=True)
class RouteAssessment:
    route_id: str
    distance_miles: float
    duration_seconds: float
    checkpoints: tuple[Checkpoint, ...]
    miles_by_level: dict[RiskLevel, float]
    avg_risk: float  # mile-weighted mean of the level score, 0 (Low) to 4 (No Travel)

    @property
    def severe_miles(self) -> float:
        return self.miles_by_level.get(RiskLevel.SEVERE, 0.0)

    @property
    def high_miles(self) -> float:
        return self.miles_by_level.get(RiskLevel.HIGH, 0.0)

    @property
    def no_travel_miles(self) -> float:
        return self.miles_by_level.get(RiskLevel.NO_TRAVEL, 0.0)

    @property
    def has_no_travel(self) -> bool:
        return any(c.level is RiskLevel.NO_TRAVEL for c in self.checkpoints)
