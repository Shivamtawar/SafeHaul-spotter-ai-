"""Turn service results into the plain structures the response serializers describe."""

from datetime import datetime
from typing import Any

from apps.trips.domain.geometry import LatLon
from apps.trips.domain.models import Checkpoint
from apps.trips.domain.risk import RiskLevel
from apps.trips.services.types import Heatmap, PlannedRoute, TripPlan

COORDINATE_DECIMALS = 5
MILE_DECIMALS = 1
WEATHER_DECIMALS = 2


def present_plan(plan: TripPlan) -> dict[str, Any]:
    return {
        "departure": _whole_seconds(plan.request.departure),
        "load_lbs": plan.request.load_lbs,
        "interval_miles": plan.request.interval_miles,
        "recommended_route_id": plan.recommended.route_id,
        "recommended_is_safe": plan.recommended_is_safe,
        "routes": [_route(r, r.rank == 1) for r in plan.routes],
        "heatmap": _heatmap(plan.heatmap),
    }


def _route(route: PlannedRoute, recommended: bool) -> dict[str, Any]:
    a = route.assessment
    return {
        "route_id": route.route_id,
        "rank": route.rank,
        "recommended": recommended,
        "distance_miles": round(a.distance_miles, MILE_DECIMALS),
        "duration_seconds": round(a.duration_seconds),
        "arrival": _whole_seconds(route.arrival),
        "avg_risk": round(a.avg_risk, 2),
        "has_no_travel": a.has_no_travel,
        "miles_by_level": {
            level.name.lower(): round(a.miles_by_level.get(level, 0.0), MILE_DECIMALS)
            for level in RiskLevel
        },
        "warnings": [{"severity": w.severity.value, "message": w.message} for w in route.warnings],
        "geometry": [_coordinate(p) for p in route.geometry],
        "checkpoints": [_checkpoint(c) for c in a.checkpoints],
    }


def _checkpoint(c: Checkpoint) -> dict[str, Any]:
    return {
        "mile": round(c.mile, MILE_DECIMALS),
        "lat": round(c.position[0], COORDINATE_DECIMALS),
        "lon": round(c.position[1], COORDINATE_DECIMALS),
        "eta": _whole_seconds(c.eta),
        "level": int(c.level),
        "level_label": c.level.label,
        "wind_mph": round(c.weather.wind_mph, WEATHER_DECIMALS),
        "rain_in_hr": round(c.weather.rain_in_hr, WEATHER_DECIMALS),
        "snow_in_hr": round(c.weather.snow_in_hr, WEATHER_DECIMALS),
        "reasons": list(c.reasons),
    }


def _heatmap(heatmap: Heatmap) -> dict[str, Any]:
    return {
        "start": _whole_seconds(heatmap.start),
        "hours": len(heatmap.points[0].levels) if heatmap.points else 0,
        "points": [
            {
                "lat": round(p.position[0], COORDINATE_DECIMALS),
                "lon": round(p.position[1], COORDINATE_DECIMALS),
                "levels": [int(level) for level in p.levels],
            }
            for p in heatmap.points
        ],
    }


def _whole_seconds(moment: datetime) -> datetime:
    return moment.replace(microsecond=0)


def _coordinate(point: LatLon) -> list[float]:
    return [round(point[0], COORDINATE_DECIMALS), round(point[1], COORDINATE_DECIMALS)]
