import pytest
from hypothesis import given
from hypothesis import strategies as st

from apps.trips.domain.risk import (
    RiskLevel,
    WeatherSample,
    assess,
    classify_rain,
    classify_snow,
    classify_wind,
)

L, M, H, S, N = (
    RiskLevel.LOW,
    RiskLevel.MODERATE,
    RiskLevel.HIGH,
    RiskLevel.SEVERE,
    RiskLevel.NO_TRAVEL,
)
CLEAR = WeatherSample(wind_mph=0, rain_in_hr=0, snow_in_hr=0)


@pytest.mark.parametrize(
    ("wind", "expected"),
    [
        (0, L), (24.9, L), (25, M), (34.9, M), (35, H), (44.9, H),
        (45, S), (54.9, S), (55, N), (80, N),
    ],
)  # fmt: skip
def test_wind_thresholds(wind: float, expected: RiskLevel) -> None:
    assert classify_wind(wind) is expected


@pytest.mark.parametrize(
    ("rain", "expected"),
    [
        (0, L), (0.099, L), (0.10, M), (0.249, M), (0.25, H), (0.499, H),
        (0.50, S), (1.00, S), (1.001, N), (3, N),
    ],
)  # fmt: skip
def test_rain_thresholds(rain: float, expected: RiskLevel) -> None:
    assert classify_rain(rain) is expected


@pytest.mark.parametrize(
    ("snow", "expected"),
    [
        (0, L), (0.49, L), (0.5, M), (0.99, M), (1.0, H), (1.99, H),
        (2.0, S), (3.0, S), (3.01, N), (6, N),
    ],
)  # fmt: skip
def test_snow_thresholds(snow: float, expected: RiskLevel) -> None:
    assert classify_snow(snow) is expected


def test_clear_weather_is_low_with_no_reasons() -> None:
    result = assess(CLEAR, load_lbs=80_000)
    assert result.level is L
    assert result.reasons == ()


def test_checkpoint_level_is_the_worst_condition() -> None:
    sample = WeatherSample(wind_mph=30, rain_in_hr=0.6, snow_in_hr=0.2)
    result = assess(sample, load_lbs=10_000)
    assert result.level is S
    assert result.reasons == ("Wind 30 mph: Moderate", "Rain 0.60 in/hr: Severe")


@pytest.mark.parametrize("load", [1, 10_000, 80_000])
def test_wind_55_is_no_travel_for_any_load(load: int) -> None:
    assert assess(WeatherSample(55, 0, 0), load).level is N


@pytest.mark.parametrize(
    ("load", "expected"),
    [(10_000, S), (30_000, S), (30_001, N), (80_000, N)],
)
def test_wind_45_to_54_with_load_over_30k_is_no_travel(load: int, expected: RiskLevel) -> None:
    result = assess(WeatherSample(50, 0, 0), load)
    assert result.level is expected


@pytest.mark.parametrize(
    ("load", "expected"),
    [(10_000, H), (40_000, H), (40_001, S), (80_000, S)],
)
def test_wind_35_to_44_with_load_over_40k_is_severe(load: int, expected: RiskLevel) -> None:
    result = assess(WeatherSample(40, 0, 0), load)
    assert result.level is expected


def test_load_rules_do_not_apply_to_lighter_winds() -> None:
    assert assess(WeatherSample(30, 0, 0), 100_000).level is M


def test_load_rule_never_lowers_a_worse_condition() -> None:
    sample = WeatherSample(wind_mph=40, rain_in_hr=1.5, snow_in_hr=0)
    assert assess(sample, load_lbs=50_000).level is N


def test_load_rule_is_explained_in_reasons() -> None:
    result = assess(WeatherSample(50, 0, 0), load_lbs=35_000)
    assert result.level is N
    assert result.reasons == (
        "Wind 50 mph: Severe",
        "35,000 lb load in 50 mph wind: No Travel",
    )


def test_risk_level_labels() -> None:
    assert N.label == "No Travel"
    assert S.label == "Severe"


@given(
    low=st.floats(0, 100),
    high=st.floats(0, 100),
    load=st.floats(0, 120_000),
)
def test_more_wind_never_lowers_the_level(low: float, high: float, load: float) -> None:
    low, high = sorted((low, high))
    assert (
        assess(WeatherSample(low, 0, 0), load).level
        <= assess(WeatherSample(high, 0, 0), load).level
    )


@given(
    wind=st.floats(0, 100),
    light=st.floats(0, 120_000),
    heavy=st.floats(0, 120_000),
)
def test_a_heavier_load_never_lowers_the_level(wind: float, light: float, heavy: float) -> None:
    light, heavy = sorted((light, heavy))
    sample = WeatherSample(wind, 0, 0)
    assert assess(sample, light).level <= assess(sample, heavy).level
