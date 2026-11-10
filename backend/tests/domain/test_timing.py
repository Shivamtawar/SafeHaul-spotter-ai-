from datetime import UTC, datetime, timedelta

import pytest

from apps.trips.domain.timing import TravelProfile

DEPARTURE = datetime(2026, 11, 12, 8, 0, tzinfo=UTC)


def test_elapsed_time_interpolates_between_steps() -> None:
    profile = TravelProfile.from_steps([(1000, 60), (1000, 120)])
    assert profile.elapsed_seconds(0) == 0
    assert profile.elapsed_seconds(0.25) == pytest.approx(30)
    assert profile.elapsed_seconds(0.5) == pytest.approx(60)
    assert profile.elapsed_seconds(0.75) == pytest.approx(120)
    assert profile.elapsed_seconds(1) == pytest.approx(180)
    assert profile.total_seconds == 180


def test_slow_segments_take_proportionally_longer() -> None:
    profile = TravelProfile.from_steps([(1000, 600), (9000, 900)])
    assert profile.elapsed_seconds(0.1) == pytest.approx(600)
    assert profile.elapsed_seconds(0.55) == pytest.approx(600 + 0.5 * 900)


def test_fraction_is_clamped() -> None:
    profile = TravelProfile.from_steps([(1000, 100)])
    assert profile.elapsed_seconds(-1) == 0
    assert profile.elapsed_seconds(5) == 100


def test_trailing_zero_distance_arrive_step_is_harmless() -> None:
    profile = TravelProfile.from_steps([(1000, 100), (0, 0)])
    assert profile.elapsed_seconds(1) == pytest.approx(100)


def test_zero_distance_step_adds_its_wait_after_the_start() -> None:
    profile = TravelProfile.from_steps([(0, 30), (1000, 60)])
    assert profile.elapsed_seconds(0.5) == pytest.approx(60)


def test_eta_adds_elapsed_time_to_departure() -> None:
    profile = TravelProfile.from_steps([(1000, 3600)])
    assert profile.eta(DEPARTURE, 0.5) == DEPARTURE + timedelta(minutes=30)


@pytest.mark.parametrize("steps", [[], [(0, 10)]])
def test_invalid_steps_are_rejected(steps: list[tuple[float, float]]) -> None:
    with pytest.raises(ValueError, match="positive distance"):
        TravelProfile.from_steps(steps)
