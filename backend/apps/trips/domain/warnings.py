"""Driver-facing warnings for a route. No Travel is deliberately loud and unambiguous."""

from dataclasses import dataclass
from enum import StrEnum

from .models import RouteAssessment
from .risk import RiskLevel


class WarningSeverity(StrEnum):
    CRITICAL = "critical"
    WARNING = "warning"


@dataclass(frozen=True, slots=True)
class RouteWarning:
    severity: WarningSeverity
    message: str


def route_warnings(route: RouteAssessment) -> tuple[RouteWarning, ...]:
    warnings: list[RouteWarning] = []
    blocked = [c for c in route.checkpoints if c.level is RiskLevel.NO_TRAVEL]
    if blocked:
        first = blocked[0]
        detail = "; ".join(first.reasons) or "unsafe weather"
        warnings.append(
            RouteWarning(
                WarningSeverity.CRITICAL,
                f"NO TRAVEL - DO NOT DISPATCH. {len(blocked)} checkpoint(s) cover about "
                f"{route.no_travel_miles:.0f} miles of unsafe weather, starting near mile "
                f"{first.mile:.0f} ({detail}). Choose a different departure time or route.",
            )
        )
    if route.severe_miles > 0:
        warnings.append(
            RouteWarning(
                WarningSeverity.WARNING,
                f"Severe weather over about {route.severe_miles:.0f} miles of this route.",
            )
        )
    return tuple(warnings)
