"""An hourly weather forecast for one location."""

from dataclasses import dataclass
from datetime import datetime, timedelta

from .errors import ForecastOutOfRangeError
from .risk import WeatherSample

ONE_HOUR = timedelta(hours=1)


@dataclass(frozen=True, slots=True)
class HourlyForecast:
    """Consecutive hourly samples; ``samples[0]`` is valid for the hour starting at ``start``."""

    start: datetime
    samples: tuple[WeatherSample, ...]

    @property
    def end(self) -> datetime:
        """The last hour covered (inclusive)."""
        return self.start + ONE_HOUR * (len(self.samples) - 1)

    def at(self, when: datetime) -> WeatherSample:
        """The sample for the hour nearest to ``when``."""
        index = round((when - self.start) / ONE_HOUR)
        if not 0 <= index < len(self.samples):
            raise ForecastOutOfRangeError("No forecast is available for that time.")
        return self.samples[index]
