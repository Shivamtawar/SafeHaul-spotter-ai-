from datetime import UTC, datetime, timedelta

import pytest

from apps.trips.domain.errors import ForecastOutOfRangeError
from apps.trips.domain.forecast import HourlyForecast
from apps.trips.domain.risk import WeatherSample

START = datetime(2026, 11, 12, 8, 0, tzinfo=UTC)
FORECAST = HourlyForecast(START, tuple(WeatherSample(float(h), 0, 0) for h in range(5)))


def test_end_is_the_last_covered_hour() -> None:
    assert FORECAST.end == START + timedelta(hours=4)


def test_reads_the_exact_hour() -> None:
    assert FORECAST.at(START + timedelta(hours=3)).wind_mph == 3


def test_reads_the_nearest_hour() -> None:
    assert FORECAST.at(START + timedelta(minutes=100)).wind_mph == 2  # 1h40 rounds to 2h
    assert FORECAST.at(START + timedelta(minutes=80)).wind_mph == 1  # 1h20 rounds to 1h


@pytest.mark.parametrize("offset_hours", [-1, 5, 100])
def test_times_outside_the_forecast_are_rejected(offset_hours: int) -> None:
    with pytest.raises(ForecastOutOfRangeError):
        FORECAST.at(START + timedelta(hours=offset_hours))
