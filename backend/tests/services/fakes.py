"""In-memory providers for service tests."""

from collections.abc import Callable, Sequence
from datetime import datetime

from apps.trips.domain.forecast import ONE_HOUR, HourlyForecast
from apps.trips.domain.geometry import LatLon
from apps.trips.domain.risk import WeatherSample
from apps.trips.providers.ports import RouteOption

WeatherFn = Callable[[LatLon, datetime], WeatherSample]

CLEAR = WeatherSample(wind_mph=5, rain_in_hr=0, snow_in_hr=0)


class FakeRouting:
    def __init__(self, options: Sequence[RouteOption]) -> None:
        self.options = list(options)
        self.calls: list[tuple[LatLon, LatLon, float]] = []

    def routes(self, origin: LatLon, destination: LatLon, *, load_lbs: float) -> list[RouteOption]:
        self.calls.append((origin, destination, load_lbs))
        return list(self.options)


class FakeWeather:
    """Weather decided by a function of (position, hour), served as hourly forecasts."""

    def __init__(self, weather: WeatherFn = lambda _p, _t: CLEAR) -> None:
        self.weather = weather
        self.calls: list[tuple[list[LatLon], datetime, datetime]] = []

    def hourly(
        self, points: Sequence[LatLon], start: datetime, end: datetime
    ) -> list[HourlyForecast]:
        self.calls.append((list(points), start, end))
        hours = round((end - start) / ONE_HOUR) + 1
        return [
            HourlyForecast(
                start=start,
                samples=tuple(self.weather(point, start + h * ONE_HOUR) for h in range(hours)),
            )
            for point in points
        ]


def route(
    geometry: Sequence[LatLon], miles: float, seconds: float, *, steps: int = 4
) -> RouteOption:
    """A route whose steps are equal shares of the distance and time."""
    return RouteOption(
        geometry=tuple(geometry),
        distance_miles=miles,
        duration_seconds=seconds,
        steps=tuple((miles / steps, seconds / steps) for _ in range(steps)),
    )
