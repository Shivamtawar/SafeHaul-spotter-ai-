"""Weather risk classification: per-condition thresholds plus the load rules from the brief.

Boundary convention: lower bounds are inclusive, so every value maps to exactly one level.
The top bands follow the brief literally (rain Severe is 0.50-1.00 inclusive, No Travel is
above 1.00; snow Severe is 2.0-3.0 inclusive, No Travel is above 3.0; wind No Travel is >= 55).
"""

from dataclasses import dataclass
from enum import IntEnum


class RiskLevel(IntEnum):
    LOW = 0
    MODERATE = 1
    HIGH = 2
    SEVERE = 3
    NO_TRAVEL = 4

    @property
    def label(self) -> str:
        return self.name.replace("_", " ").title()


@dataclass(frozen=True, slots=True)
class WeatherSample:
    wind_mph: float
    rain_in_hr: float
    snow_in_hr: float


@dataclass(frozen=True, slots=True)
class RiskAssessment:
    level: RiskLevel
    reasons: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class _Scale:
    """Lower bounds of the Moderate, High and Severe bands, and where No Travel begins."""

    moderate: float
    high: float
    severe: float
    no_travel: float
    no_travel_inclusive: bool

    def classify(self, value: float) -> RiskLevel:
        beyond = value >= self.no_travel if self.no_travel_inclusive else value > self.no_travel
        if beyond:
            return RiskLevel.NO_TRAVEL
        if value >= self.severe:
            return RiskLevel.SEVERE
        if value >= self.high:
            return RiskLevel.HIGH
        if value >= self.moderate:
            return RiskLevel.MODERATE
        return RiskLevel.LOW


WIND = _Scale(moderate=25, high=35, severe=45, no_travel=55, no_travel_inclusive=True)
RAIN = _Scale(moderate=0.10, high=0.25, severe=0.50, no_travel=1.00, no_travel_inclusive=False)
SNOW = _Scale(moderate=0.5, high=1.0, severe=2.0, no_travel=3.0, no_travel_inclusive=False)

# Load rules (pounds). Both apply to the wind bands named in the brief.
HEAVY_LOAD_NO_TRAVEL_LBS = 30_000  # 45-54 mph and above this: No Travel
VERY_HEAVY_LOAD_SEVERE_LBS = 40_000  # 35-44 mph and above this: Severe


def classify_wind(wind_mph: float) -> RiskLevel:
    return WIND.classify(wind_mph)


def classify_rain(rain_in_hr: float) -> RiskLevel:
    return RAIN.classify(rain_in_hr)


def classify_snow(snow_in_hr: float) -> RiskLevel:
    return SNOW.classify(snow_in_hr)


def assess(sample: WeatherSample, load_lbs: float) -> RiskAssessment:
    """Return the checkpoint risk: the worst single condition, raised by the load rules."""
    conditions = (
        (classify_wind(sample.wind_mph), f"Wind {sample.wind_mph:.0f} mph"),
        (classify_rain(sample.rain_in_hr), f"Rain {sample.rain_in_hr:.2f} in/hr"),
        (classify_snow(sample.snow_in_hr), f"Snow {sample.snow_in_hr:.2f} in/hr"),
    )
    level = RiskLevel.LOW
    reasons: list[str] = []
    for condition_level, text in conditions:
        if condition_level > RiskLevel.LOW:
            reasons.append(f"{text}: {condition_level.label}")
        level = max(level, condition_level)

    load_level, load_reason = _load_rule(sample.wind_mph, load_lbs)
    if load_level > RiskLevel.LOW:
        reasons.append(load_reason)
    return RiskAssessment(level=max(level, load_level), reasons=tuple(reasons))


def _load_rule(wind_mph: float, load_lbs: float) -> tuple[RiskLevel, str]:
    if WIND.severe <= wind_mph < WIND.no_travel and load_lbs > HEAVY_LOAD_NO_TRAVEL_LBS:
        return (
            RiskLevel.NO_TRAVEL,
            f"{load_lbs:,.0f} lb load in {wind_mph:.0f} mph wind: No Travel",
        )
    if WIND.high <= wind_mph < WIND.severe and load_lbs > VERY_HEAVY_LOAD_SEVERE_LBS:
        return (
            RiskLevel.SEVERE,
            f"{load_lbs:,.0f} lb load in {wind_mph:.0f} mph wind: Severe",
        )
    return RiskLevel.LOW, ""
