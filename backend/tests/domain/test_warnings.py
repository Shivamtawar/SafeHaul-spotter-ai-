from datetime import UTC, datetime

from apps.trips.domain.models import CheckpointInput, RouteAssessment
from apps.trips.domain.ranking import assess_route
from apps.trips.domain.risk import WeatherSample
from apps.trips.domain.warnings import WarningSeverity, route_warnings

ETA = datetime(2026, 11, 12, 8, 0, tzinfo=UTC)


def route_with_winds(*winds: float, distance: float = 200) -> RouteAssessment:
    step = distance / (len(winds) - 1)
    inputs = [
        CheckpointInput(i * step, (0.0, 0.0), ETA, WeatherSample(w, 0, 0))
        for i, w in enumerate(winds)
    ]
    return assess_route("r", distance, 3600, inputs, load_lbs=10_000)


def test_a_clear_route_has_no_warnings() -> None:
    assert route_warnings(route_with_winds(5, 5, 5)) == ()


def test_severe_weather_gets_a_warning() -> None:
    warnings = route_warnings(route_with_winds(5, 50, 5))
    assert [w.severity for w in warnings] == [WarningSeverity.WARNING]
    assert "Severe weather" in warnings[0].message


def test_no_travel_gets_a_critical_do_not_dispatch_warning_first() -> None:
    warnings = route_warnings(route_with_winds(5, 50, 60))
    assert [w.severity for w in warnings] == [WarningSeverity.CRITICAL, WarningSeverity.WARNING]
    message = warnings[0].message
    assert message.startswith("NO TRAVEL - DO NOT DISPATCH")
    assert "mile 200" in message
    assert "Wind 60 mph" in message
